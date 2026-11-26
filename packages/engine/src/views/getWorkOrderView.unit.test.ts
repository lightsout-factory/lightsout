import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { describe, expect, test } from '@jest/globals';
import { RunStatus } from '#src/contracts/run/RunStatus.ts';
import { ShipBlockReason } from '#src/contracts/ship/ShipBlockReason.ts';
import { ShippingStepId } from '#src/contracts/ship/ShippingStepId.ts';
import { ShipStatus } from '#src/contracts/ship/ShipStatus.ts';
import { PlanProgress } from '#src/contracts/workOrder/PlanProgress.ts';
import { WorkOrderEventKind } from '#src/contracts/workOrder/WorkOrderEventKind.ts';
import { WorkOrderMode } from '#src/contracts/workOrder/WorkOrderMode.ts';
import { getWorkOrderView } from '#src/views/getWorkOrderView.ts';
import { freshCwd } from '#tests/helpers/freshCwd.ts';

/** The work order every case reads, its folder name and its branch alike. */
const name = 'add-search';

/** Beyond any OS pid range — `process.kill(pid, 0)` reports ESRCH, so the recording process reads as gone. */
const deadPid = 999_999_999;

const searchPlan = { id: '001-search', title: 'Search', progress: PlanProgress.Implemented, createdAt: '2026-03-01T09:00:00.000Z' };

/** A record valid against the work-order contract, holding one implemented plan 001 and no history. */
const baseRecord = {
	schemaVersion: 1,
	name,
	branch: name,
	ticketRef: 'LO-7',
	mode: WorkOrderMode.MultiplePlan,
	plans: [searchPlan],
	history: [],
};

/**
 * A repo whose work-orders folder holds this work order's record, overlaid with
 * `record`, plus any `files` keyed by their path under the work-orders folder —
 * a later file at the record's own path replaces it.
 */
const setupWorkOrder = async ({ record = {}, files = {} }: { record?: Record<string, unknown>; files?: Record<string, string> } = {}) => {
	const cwd = await freshCwd();
	const workOrders = join(cwd, '.lightsout', 'work-orders');
	const contents = { [`${name}/state.json`]: JSON.stringify({ ...baseRecord, ...record }), ...files };

	for (const [path, body] of Object.entries(contents)) {
		const target = join(workOrders, path);

		await mkdir(dirname(target), { recursive: true });
		await writeFile(target, body, 'utf8');
	}

	return { cwd };
};

describe('getWorkOrderView', () => {
	test("hands back the record's plans in order, an excluded plan carrying its exclusion reason", async () => {
		const { cwd } = await setupWorkOrder({
			record: {
				plans: [
					searchPlan,
					{
						id: '002-filters',
						title: 'Filters',
						progress: PlanProgress.Ready,
						createdAt: '2026-03-02T09:00:00.000Z',
						exclusion: { at: '2026-03-04T12:00:00.000Z', reason: 'folded into search', implementationRemoved: false },
					},
				],
			},
		});

		const view = await getWorkOrderView({ cwd, name });
		const plans = view?.plans.map((plan) => ({
			id: plan.id,
			title: plan.title,
			progress: plan.progress,
			at: plan.exclusion?.at,
			reason: plan.exclusion?.reason,
		}));

		expect(plans).toEqual([
			{ id: '001-search', title: 'Search', progress: 'implemented', at: undefined, reason: undefined },
			{ id: '002-filters', title: 'Filters', progress: 'ready', at: '2026-03-04T12:00:00.000Z', reason: 'folded into search' },
		]);
	});

	test.each([
		{
			holding: 'no plan 001',
			record: {
				mode: WorkOrderMode.SinglePlan,
				plans: [],
				ticketBodyBuild: {
					runId: 'run-body',
					progress: PlanProgress.Implemented,
					startedAt: '2026-03-03T10:00:00.000Z',
					finishedAt: '2026-03-03T10:30:00.000Z',
				},
			},
			expected: {
				builtFromTicketBody: true,
				ticketBodyBuild: expect.objectContaining({ progress: 'implemented', startedAt: '2026-03-03T10:00:00.000Z', finishedAt: '2026-03-03T10:30:00.000Z' }),
			},
		},
		{
			holding: 'plan 001',
			record: { mode: WorkOrderMode.SinglePlan, plans: [searchPlan] },
			expected: { builtFromTicketBody: false, ticketBodyBuild: undefined },
		},
	])('marks a single-plan work order holding no plan 001 as built from the ticket body', async ({ record, expected }) => {
		const { cwd } = await setupWorkOrder({ record });

		const view = await getWorkOrderView({ cwd, name });

		expect({ builtFromTicketBody: view?.builtFromTicketBody, ticketBodyBuild: view?.ticketBodyBuild }).toEqual(expected);
	});

	test('draws one ship row per shipping step in order, a running step with a dead process drawn failed', async () => {
		const { cwd } = await setupWorkOrder({
			files: {
				[`${name}/ship-progress.json`]: JSON.stringify({
					branch: name,
					attempt: 1,
					maxAttempts: 3,
					pid: deadPid,
					startedAt: '2026-03-05T10:00:00.000Z',
					updatedAt: '2026-03-05T10:02:00.000Z',
					steps: [
						{ id: ShippingStepId.Integrate, status: RunStatus.Passed, startedAt: '2026-03-05T10:00:10.000Z', durationMs: 40_000 },
						{ id: ShippingStepId.Push, status: RunStatus.Running, startedAt: '2026-03-05T10:01:00.000Z' },
					],
				}),
			},
		});

		const view = await getWorkOrderView({ cwd, name });

		expect({ shipSteps: view?.shipSteps, shipLive: view?.shipLive }).toEqual({
			shipSteps: [
				{ id: 'integrate', status: 'passed', durationMs: 40_000 },
				{ id: 'push', status: 'failed', durationMs: undefined },
				{ id: 'pull-request', status: undefined, durationMs: undefined },
				{ id: 'checks', status: undefined, durationMs: undefined },
				{ id: 'merge', status: undefined, durationMs: undefined },
				{ id: 'sync', status: undefined, durationMs: undefined },
			],
			shipLive: false,
		});
	});

	test("carries a blocked ship result's reason, detail and failing checks", async () => {
		const { cwd } = await setupWorkOrder({
			files: {
				[`${name}/ship.json`]: JSON.stringify({
					status: ShipStatus.Blocked,
					branch: name,
					reason: ShipBlockReason.ChecksFailed,
					detail: 'Two checks finished red.',
					failingChecks: ['lint', 'unit tests'],
				}),
			},
		});

		const view = await getWorkOrderView({ cwd, name });

		expect(view?.shipResult).toEqual({
			status: 'blocked',
			branch: 'add-search',
			reason: 'checks-failed',
			detail: 'Two checks finished red.',
			failingChecks: ['lint', 'unit tests'],
		});
	});

	test('returns the history in recorded order', async () => {
		const { cwd } = await setupWorkOrder({
			record: {
				history: [
					{ at: '2026-03-01T09:00:00.000Z', kind: WorkOrderEventKind.PlanAdded, detail: 'added plan 001-search' },
					{ at: '2026-03-06T09:00:00.000Z', kind: WorkOrderEventKind.ShipRequested, detail: 'ship requested for 001-search' },
					{ at: '2026-03-02T09:00:00.000Z', kind: WorkOrderEventKind.PlanRetitled, detail: 'retitled plan 001-search' },
				],
			},
		});

		const view = await getWorkOrderView({ cwd, name });

		expect(view?.history).toEqual([
			{ at: '2026-03-01T09:00:00.000Z', kind: 'plan-added', detail: 'added plan 001-search' },
			{ at: '2026-03-06T09:00:00.000Z', kind: 'ship-requested', detail: 'ship requested for 001-search' },
			{ at: '2026-03-02T09:00:00.000Z', kind: 'plan-retitled', detail: 'retitled plan 001-search' },
		]);
	});

	// a valid record waits wherever a joined path would land, so only a membership guard answers undefined for each
	test.each([{ named: 'never-created' }, { named: '..' }, { named: 'a/b' }, { named: '' }])(
		'answers undefined for a name no work-order folder holds, however the name is spelled',
		async ({ named }) => {
			const { cwd } = await setupWorkOrder({
				files: {
					'../state.json': JSON.stringify({ ...baseRecord, name: '..' }),
					'a/b/state.json': JSON.stringify({ ...baseRecord, name: 'a/b' }),
				},
			});

			const view = await getWorkOrderView({ cwd, name: named });

			expect(view).toBeUndefined();
		},
	);

	test('answers undefined for a work-order folder that holds no record', async () => {
		const { cwd } = await setupWorkOrder({ files: { 'no-record/notes.md': '# notes' } });

		const view = await getWorkOrderView({ cwd, name: 'no-record' });

		expect(view).toBeUndefined();
	});

	test('draws no ship rows when no ship-progress record is on disk', async () => {
		const { cwd } = await setupWorkOrder();

		const view = await getWorkOrderView({ cwd, name });

		expect({ shipSteps: view?.shipSteps, shipLive: view?.shipLive, shipResult: view?.shipResult }).toEqual({
			shipSteps: [],
			shipLive: false,
			shipResult: undefined,
		});
	});

	test("throws naming the record when a work order's state file is corrupt", async () => {
		const { cwd } = await setupWorkOrder({ files: { [`${name}/state.json`]: '{ not json' } });

		await expect(getWorkOrderView({ cwd, name })).rejects.toThrow(/state\.json/);
	});
});
