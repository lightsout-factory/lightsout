import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from '@jest/globals';
import { PipelineKind } from '#src/contracts/run/PipelineKind.ts';
import { RunStatus } from '#src/contracts/run/RunStatus.ts';
import type { StepRecord } from '#src/contracts/run/StepRecord.ts';
import { getRunProgress } from '#src/views/getRunProgress.ts';
import { runDirFor } from '#tests/helpers/runDirFor.ts';
import { runProgressManifestOf as manifestOf } from '#tests/helpers/runProgressManifestOf.ts';
import { setupRunProgress as setupProgress } from '#tests/helpers/setupRunProgress.ts';

const runId = 'run-progress-01';

const stepOf = (overrides: Partial<StepRecord> = {}): StepRecord => ({
	id: 'implement',
	status: RunStatus.Passed,
	attempts: 1,
	durationMs: 1_000,
	...overrides,
});

/** One deterministic finding, as `StandardsFinding` declares it — only its presence in a list matters here. */
const finding = {
	rule: 'file-size',
	severity: 'blocking',
	siteKey: 'file-size:src/views/getRunProgress.ts',
	files: [{ path: 'src/views/getRunProgress.ts' }],
	detail: 'the file is over its line cap',
};

/** A refactor step's own account of implementation cleanup, as `RefactorStepReport` declares it. */
const cleanupReport = {
	roundsUsed: 2,
	endReason: 'budget-exhausted',
	remaining: [finding, finding],
	inherited: [finding],
	uncertain: [finding],
	failures: ['refactor executor timed out after 20 minutes'],
	initialReview: [],
	finalReview: [finding],
};

/** The run's rows as [id, status, attempts] triples — the whole table, minus the clock. */
const shapeOf = ({ rows }: { rows: { id: string; status: RunStatus | undefined; attempts: number }[] }) =>
	rows.map((row) => [row.id, row.status, row.attempts]);

/**
 * Three running runs with no process behind them, each frozen mid-step: an
 * implement root, a refactor root and a phase child whose coordinator is the
 * sequence that resumes it.
 */
const setupResumable = () => {
	const cwd = mkdtempSync(join(tmpdir(), 'lightsout-run-progress-'));
	const running = [stepOf({ id: 'refactor', status: RunStatus.Running, durationMs: 5_000 })];
	const manifests = [
		manifestOf({ runId: 'run-implement-01', steps: running }),
		manifestOf({ runId: 'run-refactor-01', pipeline: PipelineKind.Refactor, steps: running }),
		manifestOf({ runId: 'run-phase-child-01', parentRunId: 'run-sequence-01', steps: running }),
	];

	for (const manifest of manifests) {
		mkdirSync(runDirFor({ cwd, runId: manifest.runId }), { recursive: true });
	}

	return { cwd, manifests };
};

/**
 * Two runs, one that recorded /repo/lightsout.config.json and one that predates
 * the record, in a checkout holding a config file of its own at another path.
 */
const setupRecordedConfig = () => {
	const cwd = mkdtempSync(join(tmpdir(), 'lightsout-run-progress-'));
	const manifests = [manifestOf({ runId: 'run-recorded-01', configPath: '/repo/lightsout.config.json' }), manifestOf({ runId: 'run-unrecorded-01' })];

	writeFileSync(join(cwd, 'lightsout.config.json'), '{}', 'utf8');

	for (const manifest of manifests) {
		mkdirSync(runDirFor({ cwd, runId: manifest.runId }), { recursive: true });
	}

	return { cwd, manifests };
};

describe('getRunProgress', () => {
	test('every recorded step becomes a row, in the order the manifest records them', async () => {
		const verification = {
			failedFamilies: ['check'],
			repairAttempts: { check: 1 },
			failures: [{ kind: 'check', group: 'root', command: 'pnpm check', exitCode: 1 }],
			needsFormatting: false,
			guidedRepairAttempted: false,
		};
		const { cwd, manifest } = setupProgress({
			manifest: manifestOf({ steps: [stepOf({ id: 'clean-slate' }), stepOf({ id: 'implement', attempts: 2, verification })] }),
		});

		const progress = await getRunProgress({ cwd, manifest, live: false });

		expect(shapeOf({ rows: progress.rows })).toStrictEqual([
			['clean-slate', RunStatus.Passed, 1],
			['implement', RunStatus.Passed, 2],
		]);
		expect(progress.rows[0]?.verification).toBe(undefined);
		expect(progress.rows[1]?.verification).toStrictEqual(verification);
	});

	test('a declared step the run has not reached becomes a pending row, and a recorded one is never duplicated', async () => {
		const { cwd, manifest } = setupProgress({
			manifest: manifestOf({ steps: [stepOf({ id: 'clean-slate' })], stepOrder: ['clean-slate', 'implement', 'format'] }),
		});

		const progress = await getRunProgress({ cwd, manifest, live: false });

		expect(shapeOf({ rows: progress.rows })).toStrictEqual([
			['clean-slate', RunStatus.Passed, 1],
			['implement', undefined, 0],
			['format', undefined, 0],
		]);
		expect(progress.rows.map((row) => row.durationMs)).toStrictEqual([1_000, undefined, undefined]);
		expect(progress.rows.map((row) => row.verification)).toStrictEqual([undefined, undefined, undefined]);
	});

	test('the refactor row carries the cleanup outcome and every other row, pending and ship included, carries none', async () => {
		const { cwd, manifest } = setupProgress({
			manifest: manifestOf({
				status: RunStatus.Passed,
				willShip: true,
				branch: 'lo-124-cleanup',
				steps: [stepOf({ id: 'clean-slate' }), stepOf({ id: 'refactor', report: cleanupReport })],
				stepOrder: ['clean-slate', 'refactor', 'verify'],
			}),
		});

		const progress = await getRunProgress({ cwd, manifest, live: false });

		expect(progress.rows.map((row) => [row.id, row.cleanup])).toStrictEqual([
			['clean-slate', undefined],
			['refactor', { rounds: 2, endReason: 'budget-exhausted', remainingFindings: 2, carriedFindings: 2, reviewFindings: 1, failures: 1 }],
			['verify', undefined],
			['ship', undefined],
		]);
	});

	test('a run whose pipeline declared no order gets no pending rows at all — a guessed row is worse than none', async () => {
		const { cwd, manifest } = setupProgress({ manifest: manifestOf({ steps: [stepOf({ id: 'batch-01' })] }) });

		const progress = await getRunProgress({ cwd, manifest, live: false });

		expect(shapeOf({ rows: progress.rows })).toStrictEqual([['batch-01', RunStatus.Passed, 1]]);
	});

	test('a live run’s running row and its elapsed both carry the time since the manifest was last written', async () => {
		const updatedAt = new Date(Date.now() - 60_000).toISOString();
		const { cwd, manifest } = setupProgress({
			manifest: manifestOf({
				createdAt: new Date(Date.now() - 660_000).toISOString(),
				updatedAt,
				steps: [stepOf({ id: 'refactor', status: RunStatus.Running, durationMs: 5_000 })],
			}),
		});

		const progress = await getRunProgress({ cwd, manifest, live: true });

		expect(progress.live).toBe(true);
		// a forty-minute step frozen at its last write tells a reader nothing
		expect(progress.rows[0]?.durationMs ?? 0).toBeGreaterThanOrEqual(64_000);
		expect(progress.elapsedMs).toBeGreaterThanOrEqual(659_000);
	});

	test('a running step that has not been timed yet still ticks from zero rather than reading as no duration at all', async () => {
		const updatedAt = new Date(Date.now() - 30_000).toISOString();
		const { cwd, manifest } = setupProgress({
			manifest: manifestOf({ updatedAt, steps: [stepOf({ id: 'clean-slate', status: RunStatus.Running, durationMs: undefined })] }),
		});

		expect((await getRunProgress({ cwd, manifest, live: true })).rows[0]?.durationMs ?? 0).toBeGreaterThanOrEqual(29_000);
	});

	test('a run with no process behind it shows the persisted duration unchanged — a zombie must not read as work', async () => {
		const { cwd, manifest } = setupProgress({
			manifest: manifestOf({ steps: [stepOf({ id: 'refactor', status: RunStatus.Running, durationMs: 5_000 })] }),
		});

		const progress = await getRunProgress({ cwd, manifest, live: false });

		expect(progress.live).toBe(false);
		expect(progress.rows[0]?.durationMs).toBe(5_000);
		expect(progress.elapsedMs).toBe(600_000);
	});

	test('a manifest stamped ahead of this clock adds nothing rather than running a live step backwards', async () => {
		const { cwd, manifest } = setupProgress({
			manifest: manifestOf({
				createdAt: new Date(Date.now() - 600_000).toISOString(),
				updatedAt: new Date(Date.now() + 120_000).toISOString(),
				steps: [stepOf({ id: 'refactor', status: RunStatus.Running, durationMs: 5_000 })],
			}),
		});

		const progress = await getRunProgress({ cwd, manifest, live: true });

		expect(progress.live).toBe(true);
		// a skewed clock must not subtract time from a step that has already run
		expect(progress.rows[0]?.durationMs).toBe(5_000);
	});

	test('a manifest whose last write precedes its own creation reads as no elapsed time, never a negative one', async () => {
		const { cwd, manifest } = setupProgress({
			manifest: manifestOf({ createdAt: '2026-01-01T00:10:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', steps: [stepOf()] }),
		});

		const progress = await getRunProgress({ cwd, manifest, live: false });

		expect(progress.elapsedMs).toBe(0);
	});

	test('the now line is the last thing the run narrated, and the header comes from the manifest', async () => {
		const { cwd, manifest } = setupProgress({
			manifest: manifestOf({
				changedFiles: ['src/a.ts', 'src/b.ts'],
				commits: [],
				usage: { invocations: 2, inputTokens: 1, outputTokens: 1, cacheReadTokens: 0, cacheCreationTokens: 0, costUsd: 43.54 },
			}),
			narrated: ['step implement', 'step refactor — pass 1/3'],
		});

		const progress = await getRunProgress({ cwd, manifest, live: false });

		expect(progress).toEqual(
			expect.objectContaining({ runId, shortId: 'run-prog', title: 'demo', changedFileCount: 2, costUsd: 43.54, now: 'step refactor — pass 1/3' }),
		);
	});

	test('a run that has narrated nothing has no now line rather than an empty one', async () => {
		const { cwd, manifest } = setupProgress();

		expect((await getRunProgress({ cwd, manifest, live: false })).now).toBeUndefined();
	});

	test("the progress view names the command that resumes the run, a phase child naming its coordinator's", async () => {
		const { cwd, manifests } = setupResumable();

		const progresses = await Promise.all(manifests.map((manifest) => getRunProgress({ cwd, manifest, live: false })));

		expect(progresses.map((progress) => [progress.runId, progress.live, progress.rows[0]?.durationMs, progress.resumeCommand])).toStrictEqual([
			['run-implement-01', false, 5_000, 'lightsout resume --run run-implement-01'],
			['run-refactor-01', false, 5_000, 'lightsout refactor --run run-refactor-01'],
			['run-phase-child-01', false, 5_000, 'lightsout resume --run run-sequence-01'],
		]);
	});

	test('the progress carries the config path the run recorded, and none for a run that recorded none', async () => {
		const { cwd, manifests } = setupRecordedConfig();

		const progresses = await Promise.all(manifests.map((manifest) => getRunProgress({ cwd, manifest, live: false })));

		expect(progresses.map((progress) => [progress.runId, progress.configPath])).toStrictEqual([
			['run-recorded-01', '/repo/lightsout.config.json'],
			['run-unrecorded-01', undefined],
		]);
	});
});
