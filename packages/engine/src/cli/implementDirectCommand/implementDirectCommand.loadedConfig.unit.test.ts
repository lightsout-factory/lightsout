import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, jest, test } from '@jest/globals';
import { implementDirectCommand } from '#src/cli/implementDirectCommand/implementDirectCommand.ts';
import { parseFlags } from '#src/cli/parseFlags.ts';
import type { RunManifest } from '#src/contracts/run/RunManifest.ts';
import { RunStatus } from '#src/contracts/run/RunStatus.ts';
import type { runDirectWork } from '#src/direct/runDirectWork/runDirectWork.ts';
import type { PipelineResult } from '#src/pipeline/PipelineResult.ts';
import { captureCommandOutput } from '#tests/helpers/captureCommandOutput.ts';
import { getRejectionError } from '#tests/helpers/getRejectionError.ts';
import { seedRunFolder } from '#tests/helpers/seedRunFolder.ts';
import { setupBranchRepo } from '#tests/helpers/setupBranchRepo.ts';

// Mocked Imports
// -------------------------
// The direct run spawns a harness and records its own manifest — both covered by
// their own tests. What this command owns is the config it reads at start and
// the value it hands the run, which the stub records.
const mockRunDirectWork = jest.fn<(params: Parameters<typeof runDirectWork>[0]) => Promise<PipelineResult>>();

jest.mock('#src/direct/runDirectWork/runDirectWork.ts', () => ({
	runDirectWork: (params: Parameters<typeof runDirectWork>[0]) => mockRunDirectWork(params),
}));
// -------------------------

const passedManifest: RunManifest = {
	runId: 'run-1234-abcd',
	createdAt: '2026-01-01T00:00:00.000Z',
	updatedAt: '2026-01-01T00:00:03.000Z',
	plan: '.lightsout/runs/run-1234-abcd/ticket.md',
	harness: 'claude-code',
	status: RunStatus.Passed,
	currentStep: null,
	steps: [],
	changedFiles: [],
	commits: [],
	packages: [],
	baselineDirtyFiles: [],
	testSubjects: [],
	acceptanceTests: [],
	approvedTests: [],
	unreachableChangedFiles: [],
	coverageExcludedChangedFiles: [],
};

/** A committed branch carrying a ticket file and the given `lightsout.config.json`, with the build stubbed green. */
const setupDirectBuild = ({ config }: { config: Record<string, unknown> }) => {
	const captured = captureCommandOutput();
	const { cwd } = setupBranchRepo({ branch: 'lo-70-drain' });

	writeFileSync(join(cwd, 'lightsout.config.json'), JSON.stringify(config));
	writeFileSync(join(cwd, 'ticket.md'), '# Drain the backlog\n\nBuild the thing.\n');
	execSync('git add -A && git -c user.name=t -c user.email=t@t commit -qm setup', { cwd, stdio: 'ignore' });
	// The build is stubbed, so the run folder a real `createRun` would have made
	// is planted here — the command resolves the run's directory by id.
	seedRunFolder({ cwd, runId: passedManifest.runId });
	mockRunDirectWork.mockResolvedValue({ ok: true, manifest: passedManifest });

	return { context: { flags: parseFlags({ args: ['--ticket', 'ticket.md', '--no-worktree'] }), rest: [], cwd }, cwd, ...captured };
};

describe('implementDirectCommand', () => {
	test('a fresh direct build hands the run the config as read and its absolute path', async () => {
		const { context, cwd } = setupDirectBuild({
			config: {
				harness: 'codex',
				gates: { check: 'true', test: 'true', 'test-coverage': false },
				commands: { implement: { harness: 'claude-code' } },
			},
		});

		await expect(implementDirectCommand(context)).rejects.toThrow(/process\.exit/);

		// the global harness, not the implement entry's: the run records the file
		// as read, before the command stamps its own harness on it
		expect(mockRunDirectWork).toHaveBeenCalledWith(
			expect.objectContaining({
				loadedConfig: {
					config: {
						harness: 'codex',
						gates: { check: 'true', test: 'true', 'test-coverage': false },
						commands: { implement: { harness: 'claude-code' } },
					},
					path: join(cwd, 'lightsout.config.json'),
				},
			}),
		);
	});

	test('a misspelled config key fails a direct build at start', async () => {
		const { context, cwd } = setupDirectBuild({
			config: { gates: { check: 'true', test: 'true', 'test-coverage': false }, 'agent-comands': [] },
		});

		const error = await getRejectionError({ promise: implementDirectCommand(context) });

		// The strict read throws before anything is created; the CLI's entry lets
		// the rejection end the process, which exits 1.
		expect({
			namesFile: error.message.includes(join(cwd, 'lightsout.config.json')),
			namesKey: error.message.includes('agent-comands'),
			built: mockRunDirectWork.mock.calls.length,
		}).toStrictEqual({ namesFile: true, namesKey: true, built: 0 });
	});
});
