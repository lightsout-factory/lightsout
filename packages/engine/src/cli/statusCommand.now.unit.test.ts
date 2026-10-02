import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, jest, test } from '@jest/globals';
import { loadRunProgressBlock } from '#src/cli/internal/common/progressBlock/loadRunProgressBlock.ts';
import { statusCommand } from '#src/cli/statusCommand.ts';
import { PipelineKind } from '#src/contracts/run/PipelineKind.ts';
import type { RunManifest } from '#src/contracts/run/RunManifest.ts';
import { RunStatus } from '#src/contracts/run/RunStatus.ts';
import { type CapturedCommandOutput, captureCommandOutput } from '#tests/helpers/captureCommandOutput.ts';
import { freshCwd } from '#tests/helpers/freshCwd.ts';
import { runDirFor } from '#tests/helpers/runDirFor.ts';
import { seedRunDir } from '#tests/helpers/seedRunDir.ts';
import { usageFixture } from '#tests/helpers/usageFixture.ts';

// Mocked Imports
// -------------------------
// The two helpers that own a clock: `resolveWatchTarget` can wait a minute for
// a run to appear and `watchRunProgress` repaints every two minutes. The
// one-shot form asks the resolver for no grace at all and must never reach the
// watch; mocking both keeps a regression that falls through to the watch path
// from spending that minute, and lets the cases say it was never reached.
// Everything else — the runs folder, the manifests, the rendering — is real.
type WatchTarget = { runId: string; rootRunId: string } | { ambiguous: string[] } | undefined;
interface WatchTargetParams {
	cwd: string;
	graceMs?: number;
	pollMs?: number;
}

const mockResolveWatchTarget = jest.fn<(params: WatchTargetParams) => Promise<WatchTarget>>();
const mockWatchRunProgress = jest.fn<(params: { cwd: string; runId: string }) => Promise<void>>();

jest.mock('#src/cli/internal/common/utils/resolveWatchTarget.ts', () => ({
	resolveWatchTarget: (params: WatchTargetParams) => mockResolveWatchTarget(params),
}));
jest.mock('#src/cli/internal/common/utils/watchRunProgress.ts', () => ({
	watchRunProgress: (params: { cwd: string; runId: string }) => mockWatchRunProgress(params),
}));
// -------------------------

/** The phased coordinator, by full id — its first eight characters are what its block's title line ends with. */
const coordinatorRunId = 'c0000001-0000-4000-8000-000000000000';

/** The phase child the coordinator started, moving right now. */
const phaseRunId = 'ph000002-0000-4000-8000-000000000000';

/** A finished run, the most recently updated in a quiet repo. */
const newestRunId = 'n0000003-0000-4000-8000-000000000000';

/** A second finished run, updated before the one above. */
const olderRunId = 'o0000004-0000-4000-8000-000000000000';

/** A run family unrelated to the coordinator's — the second name in the ambiguous answer. */
const unrelatedRunId = 'u0000005-0000-4000-8000-000000000000';

type SeededManifest = Partial<RunManifest> & { runId: string };

/** The coordinator of a phased plan: one step per phase, the second of them moving. */
const coordinatorManifest: SeededManifest = {
	runId: coordinatorRunId,
	pipeline: PipelineKind.Phases,
	plan: 'plans/demo/plan.md',
	status: RunStatus.Running,
	createdAt: '2026-09-10T09:00:00.000Z',
	updatedAt: '2026-09-10T09:05:00.000Z',
	currentStep: 'phase-2',
	steps: [
		{ id: 'phase-1', status: RunStatus.Passed, attempts: 1, durationMs: 120_000 },
		{ id: 'phase-2', status: RunStatus.Running, attempts: 1, durationMs: 60_000 },
	],
};

/** The phase the coordinator is inside: its own steps, and the coordinator named as its parent. */
const phaseManifest: SeededManifest = {
	runId: phaseRunId,
	parentRunId: coordinatorRunId,
	plan: 'plans/demo/phase-2.md',
	status: RunStatus.Running,
	createdAt: '2026-09-10T09:03:00.000Z',
	updatedAt: '2026-09-10T09:06:00.000Z',
	currentStep: 'implement',
	steps: [{ id: 'implement', status: RunStatus.Running, attempts: 1, durationMs: 60_000 }],
	stepOrder: ['implement', 'test'],
};

/** A run that has ended, updated after every other seeded run — the newest of any status. */
const newestManifest: SeededManifest = {
	runId: newestRunId,
	plan: 'plans/newest/plan.md',
	status: RunStatus.Passed,
	createdAt: '2026-09-10T09:10:00.000Z',
	updatedAt: '2026-09-10T09:20:00.000Z',
	steps: [{ id: 'implement', status: RunStatus.Passed, attempts: 1, durationMs: 60_000 }],
};

/** A run that ended earlier, so a fallback taking it instead of the one above shows a different block. */
const olderManifest: SeededManifest = {
	runId: olderRunId,
	plan: 'plans/older/plan.md',
	status: RunStatus.Failed,
	createdAt: '2026-09-10T09:01:00.000Z',
	updatedAt: '2026-09-10T09:02:00.000Z',
	steps: [{ id: 'implement', status: RunStatus.Failed, attempts: 2, durationMs: 30_000 }],
};

/** One run's block exactly as `loadRunProgressBlock` draws it — the lines the one-shot form must hand back untouched. */
const blockOf = async ({ cwd, runId }: { cwd: string; runId: string }) => (await loadRunProgressBlock({ cwd, runId })).lines;

/**
 * A fresh checkout holding the given runs, with the run resolver answering the
 * given target. No run carries a lock, so no row ticks and a block drawn twice
 * reads the same both times.
 */
const setupRuns = async ({ seeded = [], target }: { seeded?: SeededManifest[]; target?: WatchTarget } = {}) => {
	const cwd = await freshCwd();

	for (const manifest of seeded) {
		await seedRunDir({ cwd, manifest });
	}

	mockResolveWatchTarget.mockResolvedValue(target);
	mockWatchRunProgress.mockResolvedValue(undefined);

	return { cwd };
};

/** A checkout where the coordinator and its running phase child are both readable, and the resolver names the child. */
const setupGoingFamily = async () => {
	const { cwd } = await setupRuns({ seeded: [coordinatorManifest, phaseManifest], target: { runId: phaseRunId, rootRunId: coordinatorRunId } });
	const coordinator = await blockOf({ cwd, runId: coordinatorRunId });
	const phase = await blockOf({ cwd, runId: phaseRunId });

	return { cwd, expected: ['', ...coordinator, '', ...phase] };
};

/** The same family, with the coordinator's manifest left half-written — its directory still stands, so the child still names it. */
const setupUnreadableCoordinator = async () => {
	const { cwd } = await setupRuns({ seeded: [coordinatorManifest, phaseManifest], target: { runId: phaseRunId, rootRunId: coordinatorRunId } });
	const phase = await blockOf({ cwd, runId: phaseRunId });

	await writeFile(join(runDirFor({ cwd, runId: coordinatorRunId, pipeline: PipelineKind.Phases }), 'manifest.json'), '{ "runId": "c0000', 'utf8');

	return { cwd, expected: ['', ...phase] };
};

/** A quiet checkout: two runs that have ended and nothing going. */
const setupNothingGoing = async () => {
	const { cwd } = await setupRuns({ seeded: [olderManifest, newestManifest] });

	return { cwd, expected: ['', ...(await blockOf({ cwd, runId: newestRunId }))] };
};

/** The lines a command printed when it ended, as report.json keeps them — opening with the report's own blank line. */
const savedReportLines = ['', 'Run n0000003 passed', 'Steps: 1 of 1 passed'];

/** Drop a saved final report into a run's folder, as the command that ended the run left it. */
const writeSavedReport = async ({ cwd, runId, pipeline, lines }: { cwd: string; runId: string; pipeline?: string; lines: string[] }) => {
	await writeFile(
		join(runDirFor({ cwd, runId, pipeline }), 'report.json'),
		JSON.stringify({ lines, exitCode: 0, finishedAt: '2026-09-10T09:20:00.000Z' }),
		'utf8',
	);
};

/** A quiet checkout whose newest run has finished and saved its final report. */
const setupNothingGoingWithSavedReport = async () => {
	const { cwd, expected } = await setupNothingGoing();

	await writeSavedReport({ cwd, runId: newestRunId, lines: savedReportLines });

	return { cwd, expected: [...expected, ...savedReportLines] };
};

/** The going family, its coordinator's folder still holding a report.json an earlier command saved. */
const setupGoingFamilyWithEarlierReport = async () => {
	const { cwd, expected } = await setupGoingFamily();

	await writeSavedReport({ cwd, runId: coordinatorRunId, pipeline: PipelineKind.Phases, lines: ['', 'an earlier attempt parked'] });

	return { cwd, expected };
};

/** Two unrelated families going at once — the answer nothing can choose between. */
const setupAmbiguous = () => setupRuns({ target: { ambiguous: [coordinatorRunId, unrelatedRunId] } });

/** A finished phased coordinator, updated after every other run in its checkout — the newest run. */
const finishedCoordinatorRunId = 'f0000006-0000-4000-8000-000000000000';

/** The coordinator's first phase, finished before its second. */
const firstFinishedPhaseRunId = 'fa000007-0000-4000-8000-000000000000';

/** The coordinator's second phase — the most recent one, which its family screen shows. */
const secondFinishedPhaseRunId = 'fb000008-0000-4000-8000-000000000000';

/** A run still marked running whose engine has died — stopped, never going. */
const stoppedRunId = 's0000009-0000-4000-8000-000000000000';

/** A pid no process holds, so an owner record naming it names a process that is gone. */
const deadPid = 999_999_999;

/**
 * A quiet checkout whose newest run is a finished phased coordinator with its
 * two phases, beside an older run still marked running whose owner record names
 * a dead process. The resolver is the real one, so whether the stopped run
 * counts as going is decided by the code under test rather than by the mock.
 */
const setupStoppedBesideNewestFamily = async () => {
	const { cwd } = await setupRuns({
		seeded: [
			{
				runId: finishedCoordinatorRunId,
				pipeline: PipelineKind.Phases,
				plan: 'plans/finished/overview.md',
				status: RunStatus.Passed,
				createdAt: '2026-09-10T10:00:00.000Z',
				updatedAt: '2026-09-10T10:30:00.000Z',
				currentStep: null,
				steps: [
					{ id: 'phase-1', status: RunStatus.Passed, attempts: 1, durationMs: 300_000, report: { runId: firstFinishedPhaseRunId } },
					{ id: 'phase-2', status: RunStatus.Passed, attempts: 1, durationMs: 420_000, report: { runId: secondFinishedPhaseRunId } },
				],
			},
			{
				runId: firstFinishedPhaseRunId,
				parentRunId: finishedCoordinatorRunId,
				plan: 'plans/finished/phase-1.md',
				status: RunStatus.Passed,
				createdAt: '2026-09-10T10:01:00.000Z',
				updatedAt: '2026-09-10T10:08:00.000Z',
				steps: [{ id: 'implement', status: RunStatus.Passed, attempts: 1, durationMs: 60_000 }],
				stepOrder: ['implement', 'test'],
			},
			{
				runId: secondFinishedPhaseRunId,
				parentRunId: finishedCoordinatorRunId,
				plan: 'plans/finished/phase-2.md',
				status: RunStatus.Passed,
				createdAt: '2026-09-10T10:09:00.000Z',
				updatedAt: '2026-09-10T10:18:00.000Z',
				steps: [{ id: 'implement', status: RunStatus.Passed, attempts: 1, durationMs: 90_000 }],
				stepOrder: ['implement', 'test'],
			},
			{
				runId: stoppedRunId,
				plan: 'plans/stopped/plan.md',
				status: RunStatus.Running,
				createdAt: '2026-09-10T09:00:00.000Z',
				updatedAt: '2026-09-10T09:30:00.000Z',
				currentStep: 'implement',
				steps: [{ id: 'implement', status: RunStatus.Running, attempts: 1, durationMs: 60_000 }],
			},
		],
	});

	await writeFile(
		join(runDirFor({ cwd, runId: stoppedRunId }), 'owner.json'),
		JSON.stringify({ pid: deadPid, recordedAt: '2026-09-10T09:00:00.000Z' }),
		'utf8',
	);

	const { resolveWatchTarget: actualResolveWatchTarget } = jest.requireActual<typeof import('#src/cli/internal/common/utils/resolveWatchTarget.ts')>(
		'#src/cli/internal/common/utils/resolveWatchTarget.ts',
	);

	mockResolveWatchTarget.mockImplementation((params) => actualResolveWatchTarget(params));

	const coordinator = await blockOf({ cwd, runId: finishedCoordinatorRunId });
	const phase = await blockOf({ cwd, runId: secondFinishedPhaseRunId });

	return { cwd, expected: ['', ...coordinator, '', ...phase] };
};

/**
 * Run the command in one checkout with its own captured streams. `process.exit`
 * throws rather than returning, so the captured exit codes are what say the
 * command ended — and anything else thrown is a real failure and rethrown.
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

describe('statusCommand --now', () => {
	test('--now prints the going run family block once and never starts a watch', async () => {
		const { cwd, expected } = await setupGoingFamily();

		const { logged, errors, exitCodes } = await runStatus({ cwd, args: { now: true } });

		expect(logged).toStrictEqual(expected);
		// both levels: the phase sequence, then the phase moving now — not one of them twice
		expect(logged.some((line) => line.endsWith('c0000001'))).toBe(true);
		expect(logged.some((line) => line.endsWith('ph000002'))).toBe(true);
		// the leading blank line and the one separating the two blocks, and no third: a repaint would append another
		expect(logged.filter((line) => line === '')).toHaveLength(2);
		expect(errors).toStrictEqual([]);
		expect(exitCodes).toStrictEqual([0]);
		expect(mockWatchRunProgress).not.toHaveBeenCalled();
	});

	test('--now with nothing going falls back to the newest run and asks its resolver for no grace at all', async () => {
		const { cwd, expected } = await setupNothingGoing();

		const { logged, errors, exitCodes } = await runStatus({ cwd, args: { now: true } });

		expect(logged).toStrictEqual(expected);
		// the newest run's block, not the older one both answers would share a shape with
		expect(logged[1]?.endsWith('n0000003')).toBe(true);
		// zero grace is what makes the answer immediate rather than a minute of waiting
		expect(mockResolveWatchTarget).toHaveBeenCalledWith({ cwd, graceMs: 0 });
		expect(errors).toStrictEqual([]);
		expect(exitCodes).toStrictEqual([0]);
		expect(mockWatchRunProgress).not.toHaveBeenCalled();
	});

	test("--now falls back to the newest run's family screen and never treats a stopped run as going", async () => {
		const { cwd, expected } = await setupStoppedBesideNewestFamily();

		const { logged, errors, exitCodes } = await runStatus({ cwd, args: { now: true } });

		expect(logged).toStrictEqual(expected);
		// the coordinator and its most recent phase, not the stopped run a status-only check would call going
		expect(logged.some((line) => line.endsWith('f0000006'))).toBe(true);
		expect(logged.some((line) => line.endsWith('fb000008'))).toBe(true);
		expect(logged.some((line) => line.endsWith('s0000009'))).toBe(false);
		expect(errors).toStrictEqual([]);
		expect(exitCodes).toStrictEqual([0]);
		expect(mockWatchRunProgress).not.toHaveBeenCalled();
	});

	test('--now falling back to a finished newest run prints its saved final report too', async () => {
		const { cwd, expected } = await setupNothingGoingWithSavedReport();

		const { logged, errors, exitCodes } = await runStatus({ cwd, args: { now: true } });

		// the newest run's block, then the saved lines exactly as saved, nothing added between or after
		expect(logged).toStrictEqual(expected);
		expect(errors).toStrictEqual([]);
		expect(exitCodes).toStrictEqual([0]);
	});

	test('--now on a going run prints no saved report', async () => {
		const { cwd, expected } = await setupGoingFamilyWithEarlierReport();

		const { logged, errors, exitCodes } = await runStatus({ cwd, args: { now: true } });

		// the family screen alone: an earlier command's report never counts for a run that is going again
		expect(logged).toStrictEqual(expected);
		expect(logged.includes('an earlier attempt parked')).toBe(false);
		expect(errors).toStrictEqual([]);
		expect(exitCodes).toStrictEqual([0]);
	});

	test('--now in a repo with no runs says so and exits 0', async () => {
		const { cwd } = await setupRuns();

		const { logged, errors, exitCodes } = await runStatus({ cwd, args: { now: true } });

		expect(logged).toStrictEqual(['no runs found']);
		expect(errors).toStrictEqual([]);
		expect(exitCodes).toStrictEqual([0]);
	});

	test("--now still answers when the going phase's coordinator manifest cannot be read", async () => {
		const { cwd, expected } = await setupUnreadableCoordinator();

		const { logged, errors, exitCodes } = await runStatus({ cwd, args: { now: true } });

		expect(logged).toStrictEqual(expected);
		// the phase the reader can still see, alone — nothing honest is left to pair it with
		expect(logged.some((line) => line.endsWith('ph000002'))).toBe(true);
		expect(logged.some((line) => line.endsWith('c0000001'))).toBe(false);
		expect(errors).toStrictEqual([]);
		expect(exitCodes).toStrictEqual([0]);
	});

	test('--now with two unrelated families going names both ids and exits 1', async () => {
		const { cwd } = await setupAmbiguous();

		const { logged, errors, exitCodes } = await runStatus({ cwd, args: { now: true } });

		// no block: narrating somebody else's concurrent work is worse than asking
		expect(logged).toStrictEqual([]);
		expect(errors).toEqual([expect.stringContaining(coordinatorRunId), expect.stringContaining('--run <id>')]);
		expect(errors[0]).toContain(unrelatedRunId);
		expect(exitCodes).toStrictEqual([1]);
		expect(mockWatchRunProgress).not.toHaveBeenCalled();
	});

	test('--now and a bare --watch describe several going runs in exactly the same words', async () => {
		const { cwd } = await setupAmbiguous();

		// two invocations because the claim IS the comparison: one state, two forms
		const now = await runStatus({ cwd, args: { now: true } });
		const watch = await runStatus({ cwd, args: { watch: true } });

		expect(now.errors).toStrictEqual(watch.errors);
		expect(now.errors).toHaveLength(2);
		expect(now.exitCodes).toStrictEqual(watch.exitCodes);
	});

	test('--now beside another status form, or carrying a value, prints the usage text and exits 1', async () => {
		const refusals: Record<string, string | true>[] = [
			{ now: true, run: newestRunId },
			{ now: true, watch: true },
			{ now: true, planning: 'demo' },
			{ now: true, shipping: 'lo-9-demo' },
			{ now: true, queue: true },
			{ now: 'a-value' },
		];
		const { cwd } = await setupRuns({ seeded: [newestManifest] });

		// each run re-points the console and exit spies at fresh arrays of its own
		const outcomes: CapturedCommandOutput[] = [];

		for (const args of refusals) {
			outcomes.push(await runStatus({ cwd, args }));
		}

		expect(outcomes.map(({ logged }) => logged)).toStrictEqual([[], [], [], [], [], []]);
		expect(outcomes.map(({ errors }) => errors)).toStrictEqual([
			[usageFixture],
			[usageFixture],
			[usageFixture],
			[usageFixture],
			[usageFixture],
			[usageFixture],
		]);
		expect(outcomes.map(({ exitCodes }) => exitCodes)).toStrictEqual([[1], [1], [1], [1], [1], [1]]);
		expect(mockWatchRunProgress).not.toHaveBeenCalled();
	});

	test('a bare status with no flags still prints the run listing', async () => {
		const { cwd } = await setupRuns({ seeded: [olderManifest, newestManifest] });

		const { logged, errors, exitCodes } = await runStatus({ cwd, args: {} });

		expect(logged).toEqual(expect.arrayContaining([expect.stringContaining(newestRunId), expect.stringContaining(olderRunId)]));
		// one line per recorded run, not a block for the run that is going
		expect(logged).toHaveLength(2);
		expect(errors).toStrictEqual([]);
		expect(exitCodes).toStrictEqual([0]);
		expect(mockResolveWatchTarget).not.toHaveBeenCalled();
	});
});
