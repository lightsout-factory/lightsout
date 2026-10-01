import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, jest, test } from '@jest/globals';
import { statusCommand } from '#src/cli/statusCommand.ts';
import type { RunManifest } from '#src/contracts/run/RunManifest.ts';
import { RunStatus } from '#src/contracts/run/RunStatus.ts';
import type { StepRecord } from '#src/contracts/run/StepRecord.ts';
import { captureCommandOutput } from '#tests/helpers/captureCommandOutput.ts';
import { runDirFor } from '#tests/helpers/runDirFor.ts';

// Mocked Imports
// -------------------------
// The two helpers that own a clock: `resolveWatchTarget` waits a minute for a
// run to appear and `watchRunProgress` repaints every two minutes, and neither
// takes its timings from this command. Each has its own test that drives those
// clocks directly; what belongs here is which of them the command reaches for.
// Everything else — the manifests, the lock, the rendering — is real.
type WatchTarget = { runId: string; rootRunId: string } | { ambiguous: string[] } | undefined;

const mockResolveWatchTarget = jest.fn<(params: { cwd: string }) => Promise<WatchTarget>>();
const mockWatchRunProgress = jest.fn<(params: { cwd: string; runId: string }) => Promise<void>>();

jest.mock('#src/cli/internal/common/utils/resolveWatchTarget.ts', () => ({
	resolveWatchTarget: (params: { cwd: string }) => mockResolveWatchTarget(params),
}));
jest.mock('#src/cli/internal/common/utils/watchRunProgress.ts', () => ({
	watchRunProgress: (params: { cwd: string; runId: string }) => mockWatchRunProgress(params),
}));
// -------------------------

const manifestOf = ({ runId, ...overrides }: { runId: string } & Partial<RunManifest>): RunManifest => ({
	runId,
	createdAt: '2026-01-01T00:00:00.000Z',
	updatedAt: '2026-01-01T00:10:00.000Z',
	plan: 'plans/demo/plan.md',
	harness: 'claude-code',
	status: RunStatus.Failed,
	currentStep: null,
	steps: [
		{
			id: 'implement',
			status: RunStatus.Failed,
			attempts: 1,
			durationMs: 160_000,
			verification: {
				failedFamilies: ['check', 'test'],
				repairAttempts: { check: 2, test: 1 },
				failures: [
					{ kind: 'check', group: 'root', command: 'pnpm check', exitCode: 1, outputTail: 'type error' },
					{ kind: 'test', group: 'api', command: 'pnpm test', exitCode: 1, outputTail: 'first line\nFINAL OUTPUT' },
				],
				needsFormatting: false,
				guidedRepairAttempted: true,
				supervisorDiagnosis: 'stale dependency graph',
			},
		},
	],
	stepOrder: ['implement', 'format'],
	changedFiles: ['src/a.ts'],
	commits: [],
	packages: [],
	baselineDirtyFiles: [],
	testSubjects: [],
	acceptanceTests: [],
	approvedTests: [],
	unreachableChangedFiles: [],
	coverageExcludedChangedFiles: [],
	...overrides,
});

/** One deterministic finding, as `StandardsFinding` declares it — only its presence in a list counts here. */
const finding = {
	rule: 'file-size',
	severity: 'blocking',
	siteKey: 'file-size:src/cli/statusCommand.ts',
	files: [{ path: 'src/cli/statusCommand.ts' }],
	detail: 'the file is over its line cap',
};

/**
 * A refactor step carrying the cleanup record `RefactorStepReport` declares —
 * rounds spent, two qualifying findings still standing, one inherited finding
 * nobody worked, and one cleanup attempt that failed. A case that names no end
 * reason gets a record with none, which is a run parked mid-loop.
 */
const refactorStepOf = ({ rounds = 2, endReason }: { rounds?: number; endReason?: string } = {}): StepRecord => ({
	id: 'refactor',
	status: RunStatus.Passed,
	attempts: 3,
	durationMs: 90_000,
	report: {
		roundsUsed: rounds,
		...(endReason === undefined ? {} : { endReason }),
		remaining: [finding, finding],
		inherited: [finding],
		uncertain: [],
		failures: ['refactor executor timed out after 20 minutes'],
		initialReview: [finding],
		finalReview: [finding],
	},
});

/** A real repo holding the given manifests, and the flag map the dispatcher would hand the command. */
const setupDetail = ({ manifests = [], args = {} }: { manifests?: RunManifest[]; args?: Record<string, string | true> } = {}) => {
	const captured = captureCommandOutput();
	const cwd = mkdtempSync(join(tmpdir(), 'lightsout-status-detail-'));

	mkdirSync(join(cwd, '.lightsout', 'runs'), { recursive: true });
	mockResolveWatchTarget.mockResolvedValue(undefined);
	mockWatchRunProgress.mockResolvedValue(undefined);

	for (const manifest of manifests) {
		mkdirSync(runDirFor({ cwd, runId: manifest.runId }), { recursive: true });
		writeFileSync(join(runDirFor({ cwd, runId: manifest.runId }), 'manifest.json'), JSON.stringify(manifest), 'utf8');
	}

	return { context: { flags: new Map<string, string | true>(Object.entries(args)), rest: [], cwd }, ...captured };
};

/** The run the cleanup cases open: the failed implement step this file already describes, with a refactor step recording a cleanup pass after it. */
const setupCleanupRun = ({ rounds, endReason }: { rounds?: number; endReason?: string } = {}) => {
	const implementSteps = manifestOf({ runId: 'run-alpha' }).steps;

	return setupDetail({
		manifests: [manifestOf({ runId: 'run-alpha', steps: [...implementSteps, refactorStepOf({ rounds, endReason })] })],
		args: { run: 'run-alpha' },
	});
};

/** The lines a passed run's command printed when it ended, as report.json holds them — the saved report opens with its own blank line. */
const savedReportLines = ['', ' run       saved-report-run', ' result    passed', ' SAVED REPORT LAST LINE'];

/** A passed run whose folder holds the final report its command saved when it ended. */
const setupFinishedRun = ({ watch = false }: { watch?: boolean } = {}) => {
	const steps: StepRecord[] = [{ id: 'implement', status: RunStatus.Passed, attempts: 1, durationMs: 60_000 }];
	const detail = setupDetail({
		manifests: [manifestOf({ runId: 'run-alpha', status: RunStatus.Passed, steps, stepOrder: ['implement'] })],
		args: watch ? { run: 'run-alpha', watch: true } : { run: 'run-alpha' },
	});
	const report = { lines: savedReportLines, exitCode: 0, finishedAt: '2026-01-01T00:11:00.000Z' };

	writeFileSync(join(runDirFor({ cwd: detail.context.cwd, runId: 'run-alpha' }), 'report.json'), JSON.stringify(report), 'utf8');

	return detail;
};

/** A passed phase child whose coordinator's manifest no longer reads, though the coordinator's folder still holds a saved report. */
const setupOrphanedPhaseChild = () => {
	const steps: StepRecord[] = [{ id: 'implement', status: RunStatus.Passed, attempts: 1, durationMs: 60_000 }];
	const detail = setupDetail({
		manifests: [manifestOf({ runId: 'run-child', parentRunId: 'run-coordinator', status: RunStatus.Passed, steps, stepOrder: ['implement'] })],
		args: { run: 'run-child' },
	});
	const coordinatorDir = runDirFor({ cwd: detail.context.cwd, runId: 'run-coordinator' });
	const report = { lines: savedReportLines, exitCode: 0, finishedAt: '2026-01-01T00:11:00.000Z' };

	mkdirSync(coordinatorDir, { recursive: true });
	writeFileSync(join(coordinatorDir, 'manifest.json'), '{ not json', 'utf8');
	writeFileSync(join(coordinatorDir, 'report.json'), JSON.stringify(report), 'utf8');

	return detail;
};

describe('statusCommand detail view', () => {
	test('bare status still prints the listing and nothing else — the view scripts read is untouched', async () => {
		const { context, logged, exitCodes } = setupDetail({ manifests: [manifestOf({ runId: 'run-alpha' })] });

		await expect(statusCommand(context)).rejects.toThrow(/process\.exit/);

		expect(logged).toStrictEqual(['run-alpha  failed  plan: plans/demo/plan.md  updated: 2026-01-01T00:10:00.000Z']);
		expect(mockWatchRunProgress).not.toHaveBeenCalled();
		expect(exitCodes).toStrictEqual([0]);
	});

	test('--run prints the block for that run and exits 0', async () => {
		const { context, logged, errors, exitCodes } = setupDetail({ manifests: [manifestOf({ runId: 'run-alpha' })], args: { run: 'run-alpha' } });

		await expect(statusCommand(context)).rejects.toThrow(/process\.exit/);

		expect(logged[0]).toBe('');
		expect(logged.some((line) => line.startsWith(' ✗  implement'))).toBe(true);
		// the step the run never reached still gets a row, from the order it declared
		expect(logged.some((line) => line.startsWith(' ·  format'))).toBe(true);
		expect(logged).toContain(' verification  check, test · groups root, api · repairs check=2, test=1 · guided yes');
		expect(logged).toContain(' diagnosis     stale dependency graph');
		expect(logged).toContain(' last output   FINAL OUTPUT');
		expect(errors).toStrictEqual([]);
		expect(exitCodes).toStrictEqual([0]);
	});

	test('--run prints the refactor step cleanup record on its own line, beside the verification one', async () => {
		const { context, logged, exitCodes } = setupCleanupRun({ endReason: 'budget-exhausted' });

		await expect(statusCommand(context)).rejects.toThrow(/process\.exit/);

		expect(logged).toContain(' cleanup       2 rounds · budget-exhausted · remaining 2 · carried 1 · failed 1');
		// the two budgets stay two lines: a cleanup round is not a verification repair
		expect(logged).toContain(' verification  check, test · groups root, api · repairs check=2, test=1 · guided yes');
		expect(logged.filter((line) => line.startsWith(' cleanup'))).toHaveLength(1);
		expect(exitCodes).toStrictEqual([0]);
	});

	test('--run says a refactor step that recorded no ending is cleanup still in progress', async () => {
		const { context, logged, exitCodes } = setupCleanupRun({ rounds: 1 });

		await expect(statusCommand(context)).rejects.toThrow(/process\.exit/);

		expect(logged).toContain(' cleanup       1 round · in progress · remaining 2 · carried 1 · failed 1');
		expect(exitCodes).toStrictEqual([0]);
	});

	test('--run on a run whose steps recorded no cleanup prints no cleanup line at all', async () => {
		const { context, logged, exitCodes } = setupDetail({ manifests: [manifestOf({ runId: 'run-alpha' })], args: { run: 'run-alpha' } });

		await expect(statusCommand(context)).rejects.toThrow(/process\.exit/);

		expect(logged.filter((line) => line.startsWith(' cleanup'))).toStrictEqual([]);
		expect(logged.some((line) => line.startsWith(' ✗  implement'))).toBe(true);
		expect(exitCodes).toStrictEqual([0]);
	});

	test('--run takes the shortened eight-character id a report printed', async () => {
		const { context, logged, exitCodes } = setupDetail({
			manifests: [manifestOf({ runId: 'e643832a-0000-4000-8000-000000000000' })],
			args: { run: 'e643832a' },
		});

		await expect(statusCommand(context)).rejects.toThrow(/process\.exit/);

		expect(logged[1]?.endsWith('e643832a')).toBe(true);
		expect(exitCodes).toStrictEqual([0]);
	});

	test('a --run matching nothing is the typed id being wrong, said once on stderr', async () => {
		const { context, logged, errors, exitCodes } = setupDetail({ manifests: [manifestOf({ runId: 'run-alpha' })], args: { run: 'ghost' } });

		await expect(statusCommand(context)).rejects.toThrow(/process\.exit/);

		expect(logged).toStrictEqual([]);
		expect(errors).toStrictEqual([`no run matching 'ghost' — list the runs this repo has with: lightsout status`]);
		expect(exitCodes).toStrictEqual([1]);
	});

	test('--run with --watch follows exactly that run', async () => {
		const { context, exitCodes } = setupDetail({ manifests: [manifestOf({ runId: 'run-alpha' })], args: { run: 'run-alpha', watch: true } });

		await expect(statusCommand(context)).rejects.toThrow(/process\.exit/);

		expect(mockWatchRunProgress).toHaveBeenCalledWith({ cwd: context.cwd, runId: 'run-alpha' });
		expect(mockResolveWatchTarget).not.toHaveBeenCalled();
		expect(exitCodes).toStrictEqual([0]);
	});

	test('--run on a finished run prints its saved final report after its block', async () => {
		const { context, logged, errors, exitCodes } = setupFinishedRun();

		await expect(statusCommand(context)).rejects.toThrow(/process\.exit/);

		const blockRow = logged.findIndex((line) => line.startsWith(' ✓  implement'));
		const reportStart = logged.length - savedReportLines.length;

		expect(logged.slice(reportStart)).toStrictEqual(savedReportLines);
		expect(blockRow).toBeGreaterThan(-1);
		expect(blockRow).toBeLessThan(reportStart);
		expect(errors).toStrictEqual([]);
		expect(exitCodes).toStrictEqual([0]);
	});

	test('--run with --watch never prints the saved final report', async () => {
		const { context, logged, exitCodes } = setupFinishedRun({ watch: true });
		mockWatchRunProgress.mockImplementation(async () => {
			console.log(' ✓  implement   (watch frame)');
		});

		await expect(statusCommand(context)).rejects.toThrow(/process\.exit/);

		expect(mockWatchRunProgress).toHaveBeenCalledWith({ cwd: context.cwd, runId: 'run-alpha' });
		expect(logged).toStrictEqual([' ✓  implement   (watch frame)']);
		expect(exitCodes).toStrictEqual([0]);
	});

	test("--run on a phase child whose coordinator will not read prints the child's block and no saved report", async () => {
		const { context, logged, errors, exitCodes } = setupOrphanedPhaseChild();

		await expect(statusCommand(context)).rejects.toThrow(/process\.exit/);

		// whether the family has finished is the coordinator's to say, so an
		// unreadable one leaves the report it may have saved unshown
		expect(logged.some((line) => line.startsWith(' ✓  implement'))).toBe(true);
		expect(logged).not.toContain(' SAVED REPORT LAST LINE');
		expect(errors).toStrictEqual([]);
		expect(exitCodes).toStrictEqual([0]);
	});

	test("a bare --watch waits for a run to be going, then follows that run's family root", async () => {
		const { context, exitCodes } = setupDetail({ manifests: [manifestOf({ runId: 'run-alpha', status: RunStatus.Running })], args: { watch: true } });

		mockResolveWatchTarget.mockResolvedValue({ runId: 'run-alpha', rootRunId: 'run-alpha' });

		await expect(statusCommand(context)).rejects.toThrow(/process\.exit/);

		// the family root: its owner stays live across a phase boundary, which is
		// what makes a phased plan watchable
		expect(mockWatchRunProgress).toHaveBeenCalledWith({ cwd: context.cwd, runId: 'run-alpha' });
		expect(exitCodes).toStrictEqual([0]);
	});

	test('a bare --watch in a repo where nothing is going paints the newest run once instead of waiting in silence', async () => {
		const { context, logged, exitCodes } = setupDetail({
			manifests: [
				manifestOf({ runId: 'run-older', updatedAt: '2026-01-01T00:01:00.000Z' }),
				manifestOf({ runId: 'run-newer', updatedAt: '2026-01-01T00:09:00.000Z' }),
			],
			args: { watch: true },
		});

		await expect(statusCommand(context)).rejects.toThrow(/process\.exit/);

		expect(mockWatchRunProgress).not.toHaveBeenCalled();
		expect(logged[1]?.endsWith('run-newe')).toBe(true);
		expect(exitCodes).toStrictEqual([0]);
	});

	test('a bare --watch in a repo with no runs at all says so, the way the listing does', async () => {
		const { context, logged, exitCodes } = setupDetail({ args: { watch: true } });

		await expect(statusCommand(context)).rejects.toThrow(/process\.exit/);

		expect(logged).toStrictEqual(['no runs found']);
		expect(exitCodes).toStrictEqual([0]);
	});
});
