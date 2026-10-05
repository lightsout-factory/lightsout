import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, jest, test } from '@jest/globals';
import { resumeCommand } from '#src/cli/resumeCommand/resumeCommand.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig/LightsoutConfig.ts';
import { runDirFor } from '#tests/helpers/runDirFor.ts';
import { setupConsumerRepo } from '#tests/helpers/setupConsumerRepo.ts';
import { manifestOf, runId, setupResume } from '#tests/helpers/setupResume.ts';

// Mocked Imports
// -------------------------
// Whether the pre-source lifecycle write can be made — and whether a gate hold
// stands against the ticket — is the guard's own contract, tested beside it.
// What this file pins is what resume does with the guard's answer. Every other
// lifecycle export stays real.
interface GuardParams {
	cwd: string;
	config: LightsoutConfig;
	env: NodeJS.ProcessEnv;
	ticketRef?: string;
	onProgress?: (message: string) => void;
}

const mockRequireImplementLifecycle = jest.fn<(params: GuardParams) => Promise<string | undefined>>();

jest.mock('#src/ticketLifecycle/requireImplementLifecycle.ts', () => ({
	requireImplementLifecycle: (params: GuardParams) => mockRequireImplementLifecycle(params),
}));
// -------------------------

/** The seeded run's manifest as it stands on disk after the command ran. */
const readManifest = ({ cwd }: { cwd: string }): { willShip?: boolean } => JSON.parse(readFileSync(join(runDirFor({ cwd, runId }), 'manifest.json'), 'utf8'));

/**
 * A seeded resume whose manifest records a workspace of its own — a second repo
 * standing in for the worktree the run was cut into, with the run folder its
 * records reach it through already there. `present: false` records a workspace
 * that has since been removed.
 *
 * The guard is answered `undefined` here, so the lifecycle write is never the
 * reason one of these cases stops.
 */
const setupResumeWorkspace = ({ present }: { present: boolean }) => {
	mockRequireImplementLifecycle.mockResolvedValue(undefined);

	const workspace = present ? setupConsumerRepo() : mkdtempSync(join(tmpdir(), 'lightsout-gone-'));

	if (present) {
		mkdirSync(runDirFor({ cwd: workspace, runId }), { recursive: true });
	} else {
		rmSync(workspace, { recursive: true, force: true });
	}

	return {
		workspace,
		...setupResume({ args: ['--run', runId], manifest: manifestOf({ pipeline: 'implement', willShip: true, workspace }) }),
	};
};

describe('resumeCommand', () => {
	test('a resumed run works in the workspace it recorded and keeps its records where they are', async () => {
		const { context, cwd, workspace, logged, errors, exitCodes } = setupResumeWorkspace({ present: true });

		await expect(resumeCommand(context)).rejects.toThrow(/process\.exit/);

		expect(logged[0]).toBe(`lightsout: resuming run ${runId} (was: failed, plan: ghost.md)`);
		// the plan is looked for under the recorded workspace, never under the
		// checkout the command was launched from: the pipeline is building there
		expect(errors.join('\n')).toContain(`plan file not found: ${join(workspace, 'ghost.md')}`);
		expect(errors.join('\n')).not.toContain(join(cwd, 'ghost.md'));
		// the resumed run names the config path it recorded — the launching checkout's file — rather than the workspace's copy
		expect(logged).toContain(`  config: ${join(cwd, 'lightsout.config.json')}`);
		// and the ship restamp still landed in the launching checkout, which is
		// where this run's records live and stay
		expect(readManifest({ cwd }).willShip).toBe(false);
		expect(exitCodes).toStrictEqual([1]);
	});

	test('a resumed run whose workspace has gone stops before anything runs', async () => {
		const { context, cwd, workspace, logged, errors, exitCodes } = setupResumeWorkspace({ present: false });

		await expect(resumeCommand(context)).rejects.toThrow(/process\.exit/);

		expect(errors.join('\n')).toContain(workspace);
		expect(exitCodes).toStrictEqual([1]);
		// no banner, no lifecycle write, and the seeded ship stamp untouched: the
		// refusal landed before any of them, so nothing was rebuilt in the
		// launching checkout by accident
		expect(logged).toStrictEqual([]);
		expect(mockRequireImplementLifecycle).not.toHaveBeenCalled();
		expect(readManifest({ cwd }).willShip).toBe(true);
	});
});
