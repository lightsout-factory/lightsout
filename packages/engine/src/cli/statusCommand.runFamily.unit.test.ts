import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, jest, test } from '@jest/globals';
import { loadRunProgressBlock } from '#src/cli/internal/common/progressBlock/loadRunProgressBlock.ts';
import { statusCommand } from '#src/cli/statusCommand.ts';
import { PipelineKind } from '#src/contracts/run/PipelineKind.ts';
import type { RunManifest } from '#src/contracts/run/RunManifest.ts';
import { RunStatus } from '#src/contracts/run/RunStatus.ts';
import { captureCommandOutput } from '#tests/helpers/captureCommandOutput.ts';
import { freshCwd } from '#tests/helpers/freshCwd.ts';
import { seedRunDir } from '#tests/helpers/seedRunDir.ts';

/** The one clock every block is drawn by, so a running row's duration reads the same in every screen. */
const pinnedNow = Date.parse('2026-09-10T09:10:00.000Z');

/** The phased coordinator, by full id — its first eight characters are what its block's title line ends with. */
const coordinatorRunId = 'c0000001-0000-4000-8000-000000000000';

/** The coordinator's first phase, finished. */
const finishedPhaseRunId = 'pa000002-0000-4000-8000-000000000000';

/** The coordinator's second phase, moving right now. */
const movingPhaseRunId = 'pb000003-0000-4000-8000-000000000000';

/** Two runs unrelated to the coordinator's family, both going. */
const unrelatedRunIds = ['u0000004-0000-4000-8000-000000000000', 'u0000005-0000-4000-8000-000000000000'];

type SeededManifest = Partial<RunManifest> & { runId: string };

const coordinatorManifest: SeededManifest = {
	runId: coordinatorRunId,
	pipeline: PipelineKind.Phases,
	plan: 'plans/phased/overview.md',
	status: RunStatus.Running,
	createdAt: '2026-09-10T09:00:00.000Z',
	updatedAt: '2026-09-10T09:05:00.000Z',
	currentStep: 'phase-2',
	steps: [
		{ id: 'phase-1', status: RunStatus.Passed, attempts: 1, durationMs: 120_000, report: { runId: finishedPhaseRunId } },
		{ id: 'phase-2', status: RunStatus.Running, attempts: 1, durationMs: 60_000, report: { runId: movingPhaseRunId } },
	],
};

const phaseManifests: SeededManifest[] = [
	{
		runId: finishedPhaseRunId,
		parentRunId: coordinatorRunId,
		plan: 'plans/phased/phase-1.md',
		status: RunStatus.Passed,
		createdAt: '2026-09-10T09:01:00.000Z',
		updatedAt: '2026-09-10T09:03:00.000Z',
		steps: [{ id: 'implement', status: RunStatus.Passed, attempts: 1, durationMs: 60_000 }],
		stepOrder: ['implement', 'test'],
	},
	{
		runId: movingPhaseRunId,
		parentRunId: coordinatorRunId,
		plan: 'plans/phased/phase-2.md',
		status: RunStatus.Running,
		createdAt: '2026-09-10T09:04:00.000Z',
		updatedAt: '2026-09-10T09:06:00.000Z',
		currentStep: 'implement',
		steps: [{ id: 'implement', status: RunStatus.Running, attempts: 1, durationMs: 60_000 }],
		stepOrder: ['implement', 'test'],
	},
];

const unrelatedManifests: SeededManifest[] = unrelatedRunIds.map((runId) => ({
	runId,
	plan: `plans/${runId.slice(0, 8)}/plan.md`,
	status: RunStatus.Running,
	createdAt: '2026-09-10T09:02:00.000Z',
	updatedAt: '2026-09-10T09:07:00.000Z',
	currentStep: 'implement',
	steps: [{ id: 'implement', status: RunStatus.Running, attempts: 1, durationMs: 30_000 }],
}));

/**
 * A checkout draining a queue: the phased family and two unrelated runs, every
 * root owned by this live test process so each counts as going. The expected
 * screen is the coordinator's block, then the moving phase's, as the loader
 * draws them before stdout is captured. The coordinator and its phases each
 * record the config path they are given, and none when given none.
 */
const setupBusyCheckout = async ({ rootConfigPath, phaseConfigPath }: { rootConfigPath?: string; phaseConfigPath?: string } = {}) => {
	jest.spyOn(Date, 'now').mockReturnValue(pinnedNow);

	const cwd = await freshCwd();
	const family = [{ ...coordinatorManifest, configPath: rootConfigPath }, ...phaseManifests.map((manifest) => ({ ...manifest, configPath: phaseConfigPath }))];

	for (const manifest of [...family, ...unrelatedManifests]) {
		const runDir = await seedRunDir({ cwd, manifest });

		if (manifest.parentRunId === undefined) {
			await writeFile(join(runDir, 'owner.json'), JSON.stringify({ pid: process.pid, recordedAt: '2026-09-10T09:00:00.000Z' }), 'utf8');
		}
	}

	const coordinator = (await loadRunProgressBlock({ cwd, runId: coordinatorRunId })).lines;
	const movingPhase = (await loadRunProgressBlock({ cwd, runId: movingPhaseRunId })).lines;

	return { cwd, expected: ['', ...coordinator, '', ...movingPhase] };
};

/**
 * Run the command with its own captured streams. `process.exit` throws rather
 * than returning, so the captured exit codes are what say the command ended —
 * and anything else thrown is a real failure and rethrown.
 */
const runStatus = async ({ cwd, args }: { cwd: string; args: Record<string, string | true> }) => {
	const captured = captureCommandOutput();

	await statusCommand({ flags: new Map<string, string | true>(Object.entries(args)), rest: [], cwd }).catch((error: unknown) => {
		if (!(error instanceof Error && error.message === 'process.exit')) {
			throw error;
		}
	});

	return captured;
};

describe('statusCommand --run on a phased family', () => {
	test("with unrelated runs going, --run naming the coordinator shows its phase list and the moving phase's steps", async () => {
		const { cwd, expected } = await setupBusyCheckout();

		const now = await runStatus({ cwd, args: { now: true } });
		const named = await runStatus({ cwd, args: { run: coordinatorRunId.slice(0, 8) } });

		// the busy checkout is one --now refuses to guess in
		expect(now.exitCodes).toStrictEqual([1]);
		expect(named.logged).toStrictEqual(expected);
		expect(named.logged.some((line) => line.endsWith('c0000001'))).toBe(true);
		expect(named.logged.some((line) => line.endsWith('pb000003'))).toBe(true);
		expect(named.errors).toStrictEqual([]);
		expect(named.exitCodes).toStrictEqual([0]);
	});

	test.each([
		{ label: 'the moving phase', runId: movingPhaseRunId },
		{ label: 'a finished phase', runId: finishedPhaseRunId },
	])("--run naming $label prints the same screen as naming the coordinator's", async ({ runId }) => {
		const { cwd, expected } = await setupBusyCheckout();

		const named = await runStatus({ cwd, args: { run: runId } });

		expect(named.logged).toStrictEqual(expected);
		expect(named.errors).toStrictEqual([]);
		expect(named.exitCodes).toStrictEqual([0]);
	});

	test("--run naming a phase ends the screen with the coordinator's recorded config path, not the phase's", async () => {
		const { cwd, expected } = await setupBusyCheckout({
			rootConfigPath: '/repo/lightsout.config.json',
			phaseConfigPath: '/repo/worktrees/phase-2/lightsout.config.json',
		});

		const named = await runStatus({ cwd, args: { run: movingPhaseRunId } });

		expect({ logged: named.logged, errors: named.errors, exitCodes: named.exitCodes }).toStrictEqual({
			logged: [...expected, '  config: /repo/lightsout.config.json'],
			errors: [],
			exitCodes: [0],
		});
	});
});
