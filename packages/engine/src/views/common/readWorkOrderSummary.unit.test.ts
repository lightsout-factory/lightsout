import { mkdir, utimes, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { describe, expect, test } from '@jest/globals';
import { PlanningStep } from '#src/contracts/plan/progress/PlanningStep.ts';
import type { PlanningStepRecord } from '#src/contracts/plan/progress/PlanningStepRecord.ts';
import { RunStatus } from '#src/contracts/run/RunStatus.ts';
import { ShipBlockReason } from '#src/contracts/ship/ShipBlockReason.ts';
import { ShipStatus } from '#src/contracts/ship/ShipStatus.ts';
import { PlanProgress } from '#src/contracts/workOrder/PlanProgress.ts';
import { WorkOrderEventKind } from '#src/contracts/workOrder/WorkOrderEventKind.ts';
import { WorkOrderMode } from '#src/contracts/workOrder/WorkOrderMode.ts';
import type { WorkOrderPlan } from '#src/contracts/workOrder/WorkOrderPlan.ts';
import type { WorkOrderState } from '#src/contracts/workOrder/WorkOrderState.ts';
import { writeRunOwner } from '#src/runState/owner/writeRunOwner.ts';
import { readWorkOrderSummary } from '#src/views/common/readWorkOrderSummary.ts';
import { freshCwd } from '#tests/helpers/freshCwd.ts';
import { seedRunDir } from '#tests/helpers/seedRunDir.ts';

/** Beyond any OS pid range — `process.kill(pid, 0)` reports ESRCH, so the recording process reads as gone. */
const deadPid = 999_999_999;

const name = 'lo-13-rebuild-app';

/** Older than anything a case names as newest, so the baseline never wins a newest-timestamp race. */
const baseline = '2026-01-01T00:00:00.000Z';

/** One plan as a record holds it; `excluded` adds the exclusion that takes it out of the counted plans. */
const planOf = ({ id, progress, excluded = false }: { id: string; progress: PlanProgress; excluded?: boolean }): WorkOrderPlan => ({
	id,
	title: `Plan ${id}`,
	progress,
	createdAt: baseline,
	...(excluded ? { exclusion: { at: baseline, reason: 'out of scope', implementationRemoved: false } } : {}),
});

interface ShipProgressSeed {
	pid: number;
	endedAt?: string;
	updatedAt?: string;
}

interface PlanningSeed {
	planId: string;
	updatedAt?: string;
	step: Pick<PlanningStepRecord, 'status' | 'pid'>;
}

interface RunSeed {
	runId: string;
	status: RunStatus;
	updatedAt?: string;
	/** Records this process as the run's owner, so the run reads as live while it is going. */
	owned?: boolean;
}

interface SetupParams {
	mode?: WorkOrderMode;
	plans?: WorkOrderPlan[];
	shipped?: boolean;
	ticketBodyBuild?: WorkOrderState['ticketBodyBuild'];
	history?: WorkOrderState['history'];
	shipResult?: Record<string, unknown>;
	shipProgress?: ShipProgressSeed;
	planning?: PlanningSeed;
	runs?: RunSeed[];
	/** Pushes every file written a year past now, so a reader of modification times would pick a time no record holds. */
	mtimesAhead?: boolean;
}

/**
 * One work order on disk in a fresh repo: its record, and whichever ship result,
 * ship-progress record, planning record and run manifests the case names, each
 * filed where its own reader looks for it.
 */
const setupWorkOrder = async ({
	mode = WorkOrderMode.MultiplePlan,
	plans = [planOf({ id: '001-first', progress: PlanProgress.Implemented })],
	shipped = false,
	ticketBodyBuild,
	history = [],
	shipResult,
	shipProgress,
	planning,
	runs = [],
	mtimesAhead = false,
}: SetupParams = {}) => {
	const cwd = await freshCwd();
	const folder = join(cwd, '.lightsout', 'work-orders', name);
	const written: string[] = [];
	const writeJson = async ({ path, value }: { path: string; value: unknown }) => {
		await mkdir(dirname(path), { recursive: true });
		await writeFile(path, JSON.stringify(value), 'utf8');
		written.push(path);
	};
	const record: WorkOrderState = {
		schemaVersion: 1,
		name,
		branch: name,
		ticketRef: 'LO-13',
		mode,
		plans,
		...(ticketBodyBuild === undefined ? {} : { ticketBodyBuild }),
		...(shipped ? { shipped: { at: baseline, planIds: plans.map((plan) => plan.id), mergeCommit: '0f1e2d3c' } } : {}),
		history,
	};

	await writeJson({ path: join(folder, 'state.json'), value: record });

	if (shipResult !== undefined) {
		await writeJson({ path: join(folder, 'ship.json'), value: { branch: name, failingChecks: [], ...shipResult } });
	}

	if (shipProgress !== undefined) {
		await writeJson({
			path: join(folder, 'ship-progress.json'),
			value: {
				branch: name,
				attempt: 1,
				maxAttempts: 3,
				pid: shipProgress.pid,
				startedAt: baseline,
				updatedAt: shipProgress.updatedAt ?? baseline,
				...(shipProgress.endedAt === undefined ? {} : { endedAt: shipProgress.endedAt }),
				steps: [],
			},
		});
	}

	if (planning !== undefined) {
		await writeJson({
			path: join(folder, 'plans', planning.planId, 'planning-progress.json'),
			value: {
				name: planning.planId,
				updatedAt: planning.updatedAt ?? baseline,
				steps: [{ step: PlanningStep.Draft, attempts: 1, startedAt: baseline, ...planning.step }],
			},
		});
	}

	for (const run of runs) {
		const runDir = await seedRunDir({
			cwd,
			manifest: { runId: run.runId, planName: `${name}/001-first`, status: run.status, updatedAt: run.updatedAt ?? baseline },
		});

		written.push(join(runDir, 'manifest.json'));

		if (run.owned === true) {
			await writeRunOwner({ cwd, runId: run.runId });
		}
	}

	if (mtimesAhead) {
		const ahead = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

		await Promise.all(written.map((path) => utimes(path, ahead, ahead)));
	}

	return { cwd, record };
};

describe('readWorkOrderSummary', () => {
	test.each([
		{ shipped: true, shipResult: undefined },
		{ shipped: false, shipResult: { status: ShipStatus.Shipped, prUrl: 'https://example.test/pr/7', mergedAt: baseline } },
	])('derives shipped from a shipped record or a shipped ship result before any other state', async ({ shipped, shipResult }) => {
		const { cwd, record } = await setupWorkOrder({
			plans: [planOf({ id: '001-first', progress: PlanProgress.Failed })],
			shipped,
			shipResult,
			shipProgress: { pid: process.pid },
		});

		const { summary } = await readWorkOrderSummary({ cwd, name, record });

		expect(summary.status).toBe('shipped');
	});

	test('derives shipping while an unended ship record has a live process', async () => {
		const { cwd, record } = await setupWorkOrder({
			shipResult: { status: ShipStatus.Blocked, reason: ShipBlockReason.ChecksFailed, detail: 'checks went red' },
			shipProgress: { pid: process.pid },
		});

		const { summary } = await readWorkOrderSummary({ cwd, name, record });

		expect(summary.status).toBe('shipping');
	});

	test.each([
		{
			plans: [planOf({ id: '001-first', progress: PlanProgress.Implemented })],
			shipResult: { status: ShipStatus.Blocked, reason: ShipBlockReason.ChecksFailed, detail: 'checks went red' },
			shipProgress: undefined,
			expected: 'blocked',
		},
		{
			plans: [planOf({ id: '001-first', progress: PlanProgress.Implemented })],
			shipResult: undefined,
			shipProgress: { pid: deadPid },
			expected: 'blocked',
		},
		{
			plans: [planOf({ id: '001-first', progress: PlanProgress.Implemented }), planOf({ id: '002-second', progress: PlanProgress.Failed })],
			shipResult: undefined,
			shipProgress: undefined,
			expected: 'blocked',
		},
		{
			plans: [planOf({ id: '001-first', progress: PlanProgress.Failed, excluded: true })],
			shipResult: undefined,
			shipProgress: undefined,
			expected: 'planning',
		},
	])(
		'derives blocked from a blocked ship result, a ship record left with no live process, or a failed counted plan',
		async ({ plans, shipResult, shipProgress, expected }) => {
			const { cwd, record } = await setupWorkOrder({ plans, shipResult, shipProgress });

			const { summary } = await readWorkOrderSummary({ cwd, name, record });

			expect(summary.status).toBe(expected);
		},
	);

	test.each([
		{
			mode: WorkOrderMode.MultiplePlan,
			plans: [planOf({ id: '001-first', progress: PlanProgress.Implemented }), planOf({ id: '002-second', progress: PlanProgress.Implementing })],
			ticketBodyBuild: undefined,
		},
		{
			mode: WorkOrderMode.SinglePlan,
			plans: [],
			ticketBodyBuild: { runId: 'run-body', progress: PlanProgress.Implementing, startedAt: baseline },
		},
	])('derives building while a counted plan or the ticket-body build is implementing', async ({ mode, plans, ticketBodyBuild }) => {
		const { cwd, record } = await setupWorkOrder({ mode, plans, ticketBodyBuild });

		const { summary } = await readWorkOrderSummary({ cwd, name, record });

		expect(summary.status).toBe('building');
	});

	test.each([
		{
			mode: WorkOrderMode.MultiplePlan,
			plans: [
				planOf({ id: '001-first', progress: PlanProgress.Implemented }),
				planOf({ id: '002-second', progress: PlanProgress.Implemented }),
				planOf({ id: '003-third', progress: PlanProgress.Ready, excluded: true }),
			],
			ticketBodyBuild: undefined,
			expected: 'ready-to-ship',
		},
		{
			mode: WorkOrderMode.SinglePlan,
			plans: [],
			ticketBodyBuild: { runId: 'run-body', progress: PlanProgress.Implemented, startedAt: baseline, finishedAt: baseline },
			expected: 'ready-to-ship',
		},
		{
			mode: WorkOrderMode.MultiplePlan,
			plans: [planOf({ id: '001-first', progress: PlanProgress.Implemented }), planOf({ id: '002-second', progress: PlanProgress.Ready })],
			ticketBodyBuild: undefined,
			expected: 'planning',
		},
	])('derives ready to ship when every counted plan is implemented, and planning while any is not', async ({ mode, plans, ticketBodyBuild, expected }) => {
		const { cwd, record } = await setupWorkOrder({ mode, plans, ticketBodyBuild });

		const { summary } = await readWorkOrderSummary({ cwd, name, record });

		expect(summary.status).toBe(expected);
	});

	test('counts excluded plans in neither plans done nor plans total', async () => {
		const { cwd, record } = await setupWorkOrder({
			plans: [
				planOf({ id: '001-first', progress: PlanProgress.Implemented, excluded: true }),
				planOf({ id: '002-second', progress: PlanProgress.Implemented }),
				planOf({ id: '003-third', progress: PlanProgress.Ready }),
			],
		});

		const { summary } = await readWorkOrderSummary({ cwd, name, record });

		expect({ plansDone: summary.plansDone, plansTotal: summary.plansTotal }).toStrictEqual({ plansDone: 1, plansTotal: 2 });
	});

	test.each([
		{
			shipResult: { status: ShipStatus.Shipped, prUrl: 'https://example.test/pr/7', mergedAt: baseline },
			expected: 'https://example.test/pr/7',
		},
		{
			shipResult: { status: ShipStatus.Blocked, reason: ShipBlockReason.MergeRejected, prUrl: 'https://example.test/pr/8' },
			expected: undefined,
		},
	])('carries the pull request link only from a shipped ship result', async ({ shipResult, expected }) => {
		const { cwd, record } = await setupWorkOrder({ shipResult });

		const { summary } = await readWorkOrderSummary({ cwd, name, record });

		expect(summary.prUrl).toBe(expected);
	});

	test.each([
		{ newest: 'history', expected: '2026-06-01T09:00:00.000Z' },
		{ newest: 'ship result', expected: '2026-06-02T09:00:00.000Z' },
		{ newest: 'ship progress', expected: '2026-06-03T09:00:00.000Z' },
		{ newest: 'planning progress', expected: '2026-06-04T09:00:00.000Z' },
		{ newest: 'run manifest', expected: '2026-06-05T09:00:00.000Z' },
	])("takes its updated time from the newest recorded timestamp, never from a file's modification time", async ({ newest, expected }) => {
		const at = (source: string) => (source === newest ? expected : baseline);
		const { cwd, record } = await setupWorkOrder({
			history: [{ at: at('history'), kind: WorkOrderEventKind.PlanAdded, detail: 'plan 001-first added' }],
			shipResult: { status: ShipStatus.Shipped, prUrl: 'https://example.test/pr/7', mergedAt: at('ship result') },
			shipProgress: { pid: deadPid, endedAt: baseline, updatedAt: at('ship progress') },
			planning: { planId: '001-first', updatedAt: at('planning progress'), step: { status: RunStatus.Passed, pid: deadPid } },
			runs: [{ runId: 'run-done', status: RunStatus.Passed, updatedAt: at('run manifest') }],
			mtimesAhead: true,
		});

		const { summary } = await readWorkOrderSummary({ cwd, name, record });

		expect(summary.updatedAt).toBe(expected);
	});

	test('falls back to the epoch for its updated time when nothing in its files records a time', async () => {
		const { cwd, record } = await setupWorkOrder({ mode: WorkOrderMode.SinglePlan, plans: [] });

		const { summary } = await readWorkOrderSummary({ cwd, name, record });

		expect(summary.updatedAt).toBe('1970-01-01T00:00:00.000Z');
	});

	test.each([
		{
			runs: [{ runId: 'run-going', status: RunStatus.Running, owned: true }],
			planning: { planId: '001-first', step: { status: RunStatus.Passed, pid: deadPid } },
			shipProgress: { pid: process.pid, endedAt: baseline },
			expected: true,
		},
		{
			runs: [{ runId: 'run-done', status: RunStatus.Passed }],
			planning: { planId: '001-first', step: { status: RunStatus.Running, pid: process.pid } },
			shipProgress: { pid: process.pid, endedAt: baseline },
			expected: true,
		},
		{
			runs: [{ runId: 'run-done', status: RunStatus.Passed }],
			planning: { planId: '001-first', step: { status: RunStatus.Passed, pid: deadPid } },
			shipProgress: { pid: process.pid },
			expected: true,
		},
		{
			runs: [{ runId: 'run-done', status: RunStatus.Passed }],
			planning: { planId: '001-first', step: { status: RunStatus.Passed, pid: process.pid } },
			shipProgress: { pid: process.pid, endedAt: baseline },
			expected: false,
		},
	])('is live while one of its processes stands behind it and not once everything has finished', async ({ runs, planning, shipProgress, expected }) => {
		const { cwd, record } = await setupWorkOrder({ runs, planning, shipProgress });

		const { summary } = await readWorkOrderSummary({ cwd, name, record });

		expect(summary.live).toBe(expected);
	});
});
