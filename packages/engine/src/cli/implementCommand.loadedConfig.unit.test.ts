import { execSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, jest, test } from '@jest/globals';
import { parseFlags } from '#src/cli/common/args/parseFlags.ts';
import { implementCommand } from '#src/cli/implementCommand.ts';
import { LightsoutConfig } from '#src/contracts/LightsoutConfig/LightsoutConfig.ts';
import type { PipelineResult } from '#src/pipeline/PipelineResult.ts';
import { captureCommandOutput } from '#tests/helpers/captureCommandOutput.ts';
import { setupConsumerRepo } from '#tests/helpers/setupConsumerRepo.ts';

// Mocked Imports
// -------------------------
// The two pipeline doors are where the command hands its config on, so both are
// doubled: what each was handed is the whole claim of this file. Everything
// before them — the inputs, the config read, the workspace, the lifecycle guard
// and the banner — runs for real.
type PipelineParams = Parameters<typeof import('#src/cli/internal/common/utils/runPipelineOrFailFast.ts')['runPipelineOrFailFast']>[0];
type PhasesParams = Parameters<typeof import('#src/cli/internal/common/utils/runPhasesOrFailFast.ts')['runPhasesOrFailFast']>[0];

const mockRunPipelineOrFailFast = jest.fn<(params: PipelineParams) => Promise<PipelineResult>>();

jest.mock('#src/cli/internal/common/utils/runPipelineOrFailFast.ts', () => ({
	runPipelineOrFailFast: (params: PipelineParams) => mockRunPipelineOrFailFast(params),
}));
// -------------------------
const mockRunPhasesOrFailFast = jest.fn<(params: PhasesParams) => Promise<PipelineResult>>();

jest.mock('#src/cli/internal/common/utils/runPhasesOrFailFast.ts', () => ({
	runPhasesOrFailFast: (params: PhasesParams) => mockRunPhasesOrFailFast(params),
}));
// -------------------------
// A spy that runs the real opener, so a run that gets that far opens its
// workspace as it always does, and a run refused at its config read is seen
// never to have reached it.
const { openImplementWorkspace: actualOpenImplementWorkspace } = jest.requireActual<
	typeof import('#src/cli/internal/common/implementRun/openImplementWorkspace.ts')
>('#src/cli/internal/common/implementRun/openImplementWorkspace.ts');

type OpenParams = Parameters<typeof actualOpenImplementWorkspace>[0];

const mockOpenImplementWorkspace = jest.fn<typeof actualOpenImplementWorkspace>();

jest.mock('#src/cli/internal/common/implementRun/openImplementWorkspace.ts', () => ({
	openImplementWorkspace: (params: OpenParams) => mockOpenImplementWorkspace(params),
}));
// -------------------------
// The report card reads a run directory no doubled pipeline ever wrote, and the
// ship tail would ask a forge; neither is what these cases are about.
const mockRenderResult = jest.fn<(params: { result: PipelineResult; cwd: string }) => Promise<string[]>>();

jest.mock('#src/cli/internal/common/render/renderResult.ts', () => ({
	renderResult: (params: { result: PipelineResult; cwd: string }) => mockRenderResult(params),
}));
// -------------------------
const mockShipAfterImplement = jest.fn<(params: { cwd: string; result: PipelineResult }) => Promise<number>>();

jest.mock('#src/cli/internal/common/utils/shipAfterImplement.ts', () => ({
	shipAfterImplement: (params: { cwd: string; result: PipelineResult }) => mockShipAfterImplement(params),
}));
// -------------------------
jest.mock('#src/runState/finalReport/writeRunFinalReport.ts', () => ({
	writeRunFinalReport: () => Promise.resolve(),
}));
// -------------------------

/** The plan folder the phased case points `--plan` at. */
const planFolder = join('plans', 'demo');

/** A run that passed, which is all the doubled report card and ship tail need to be handed. */
const passedResult = { ok: true, manifest: { runId: 'aaaaaaaa-1111-2222-3333-444444444444' } } as unknown as PipelineResult;

/** The file as the engine's own schema parses it — the value a run must record, before any command stamps it. */
const parseConfigFile = ({ cwd }: { cwd: string }) => LightsoutConfig.parse(JSON.parse(readFileSync(join(cwd, 'lightsout.config.json'), 'utf8')));

/** Commits whatever the fixture planted, because a run in the launching checkout refuses a dirty tree. */
const commitAll = ({ cwd, message }: { cwd: string; message: string }) => {
	execSync(`git add -A && git -c user.name=t -c user.email=t@t commit -qm ${message} --allow-empty`, { cwd, stdio: 'ignore' });
};

/** An overview whose Phases table names one phase file, beside the file itself. */
const writePhasedPlanFolder = ({ cwd }: { cwd: string }) => {
	mkdirSync(join(cwd, planFolder), { recursive: true });
	writeFileSync(
		join(cwd, planFolder, 'overview.md'),
		'# Feature — Overview\n\n## Phases\n\n| # | File | Scope |\n|---|------|-------|\n| 1 | `phase1.md` | scope |\n',
	);
	writeFileSync(join(cwd, planFolder, 'phase1.md'), '# Feature — Phase 1\n');
};

/**
 * A real consumer repo in which `implement` builds where it was launched, with
 * both pipeline doors answering a pass. `config` is merged over the repo's
 * config file; `phased` plants a plan folder holding an overview, which `--plan`
 * then names in place of the repo's root plan.md.
 */
const setupImplementLoadedConfig = ({ config, phased = false }: { config?: Record<string, unknown>; phased?: boolean } = {}) => {
	const captured = captureCommandOutput();
	const cwd = setupConsumerRepo({ config });

	if (phased) {
		writePhasedPlanFolder({ cwd });
		commitAll({ cwd, message: 'plans' });
	}

	mockOpenImplementWorkspace.mockImplementation(actualOpenImplementWorkspace);
	mockRunPipelineOrFailFast.mockResolvedValue(passedResult);
	mockRunPhasesOrFailFast.mockResolvedValue(passedResult);
	mockRenderResult.mockResolvedValue([]);
	mockShipAfterImplement.mockResolvedValue(0);

	const args = ['--plan', phased ? planFolder : 'plan.md', '--no-worktree'];

	return { context: { flags: parseFlags({ args }), rest: [], cwd }, cwd, configPath: join(cwd, 'lightsout.config.json'), ...captured };
};

/**
 * One finished `implement` in the repo, then its config file edited — a gate
 * command changed — and committed, so the next run starts from a clean tree
 * that holds the edit. What the first run was handed is returned for the
 * comparison.
 */
const setupEditedBetweenRuns = async () => {
	const arranged = setupImplementLoadedConfig({ config: { gates: { check: 'pnpm check:before', test: 'true', 'test-coverage': false } } });

	await implementCommand(arranged.context).catch((error: unknown) => {
		if (!(error instanceof Error && error.message === 'process.exit')) {
			throw error;
		}
	});

	const firstCheck = mockRunPipelineOrFailFast.mock.calls[0]?.[0].loadedConfig.config.gates.check;
	writeFileSync(arranged.configPath, readFileSync(arranged.configPath, 'utf8').replace('pnpm check:before', 'pnpm check:after'));
	commitAll({ cwd: arranged.cwd, message: 'edit-config' });

	return { ...arranged, firstCheck };
};

describe('implementCommand loaded config', () => {
	test('a fresh implement hands the pipeline the config as read and its absolute path', async () => {
		const { context, cwd, configPath } = setupImplementLoadedConfig({
			config: { harness: 'codex', commands: { implement: { harness: 'claude-code' } } },
		});

		await expect(implementCommand(context)).rejects.toThrow(/process\.exit/);

		const handed = mockRunPipelineOrFailFast.mock.calls[0]?.[0];

		// the recorded config keeps the file's global harness; only the stamped one
		// carries the harness the implement entry asked for
		expect({
			loadedConfig: handed?.loadedConfig,
			recordedHarness: handed?.loadedConfig.config.harness,
			stampedHarness: handed?.config.harness,
		}).toStrictEqual({
			loadedConfig: { config: parseConfigFile({ cwd }), path: configPath },
			recordedHarness: 'codex',
			stampedHarness: 'claude-code',
		});
	});

	test('a fresh phased implement hands the sequence the config as read and its path', async () => {
		const { context, cwd, configPath } = setupImplementLoadedConfig({ phased: true });

		await expect(implementCommand(context)).rejects.toThrow(/process\.exit/);

		expect({
			loadedConfig: mockRunPhasesOrFailFast.mock.calls[0]?.[0].loadedConfig,
			singlePlanCalls: mockRunPipelineOrFailFast.mock.calls.length,
		}).toStrictEqual({ loadedConfig: { config: parseConfigFile({ cwd }), path: configPath }, singlePlanCalls: 0 });
	});

	test('a new run reads the edited config file', async () => {
		const { context, firstCheck } = await setupEditedBetweenRuns();

		await expect(implementCommand(context)).rejects.toThrow(/process\.exit/);

		expect({ firstCheck, secondCheck: mockRunPipelineOrFailFast.mock.calls[1]?.[0].loadedConfig.config.gates.check }).toStrictEqual({
			firstCheck: 'pnpm check:before',
			secondCheck: 'pnpm check:after',
		});
	});

	test('a misspelled config key fails the run at start before anything is created', async () => {
		const { context, configPath } = setupImplementLoadedConfig({ config: { timeuots: { 'agent-minutes': 90 } } });

		// the command throws rather than exiting itself: the CLI entry turns the
		// rejection into exit code 1, as it does for every config it cannot read
		const failed = implementCommand(context);

		await expect(failed).rejects.toThrow(configPath);
		await expect(failed).rejects.toThrow(/timeuots/u);
		expect({
			workspacesOpened: mockOpenImplementWorkspace.mock.calls.length,
			pipelineCalls: mockRunPipelineOrFailFast.mock.calls.length,
			phasesCalls: mockRunPhasesOrFailFast.mock.calls.length,
		}).toStrictEqual({ workspacesOpened: 0, pipelineCalls: 0, phasesCalls: 0 });
	});
});
