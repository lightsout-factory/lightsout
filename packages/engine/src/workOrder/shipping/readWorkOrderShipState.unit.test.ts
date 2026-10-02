import { describe, expect, test } from '@jest/globals';
import type { WorkOrderPlan } from '#src/contracts/workOrder/WorkOrderPlan.ts';
import type { WorkOrderState } from '#src/contracts/workOrder/WorkOrderState.ts';
import { readWorkOrderShipState } from '#src/workOrder/shipping/readWorkOrderShipState.ts';

const mergeCommit = '9c4e2f7a1b3d5e6f8091a2b3c4d5e6f708192a3b';
const authorization = { by: 'Dana Reyes dana@example.com', at: '2026-01-07T00:00:00.000Z' };

const planWith = ({ id, progress, exclusionReason }: { id: string; progress: WorkOrderPlan['progress']; exclusionReason?: string }): WorkOrderPlan => ({
	id,
	title: `Plan ${id}`,
	progress,
	createdAt: '2026-01-01T00:00:00.000Z',
	...(exclusionReason ? { exclusion: { at: '2026-01-04T00:00:00.000Z', reason: exclusionReason, implementationRemoved: false } } : {}),
});

/** A build from the ticket body at the progress asked for; one still implementing has not finished. */
const buildWith = ({ runId, progress }: { runId: string; progress: 'implementing' | 'implemented' | 'failed' }): WorkOrderState['ticketBodyBuild'] => ({
	runId,
	progress,
	startedAt: '2026-01-05T00:00:00.000Z',
	...(progress === 'implementing' ? {} : { finishedAt: '2026-01-06T00:00:00.000Z' }),
});

const recordWith = ({
	mode,
	plans = [],
	shipRequest,
	shipped,
	ticketBodyBuild,
	handBuiltShipAuthorization,
}: {
	mode: WorkOrderState['mode'];
	plans?: WorkOrderPlan[];
	shipRequest?: string[];
	shipped?: boolean;
	ticketBodyBuild?: WorkOrderState['ticketBodyBuild'];
	handBuiltShipAuthorization?: { by: string; at: string };
}): WorkOrderState => ({
	schemaVersion: 1,
	name: 'lo-140-multi',
	ticketRef: 'LO-140',
	branch: 'lo-140-multi',
	mode,
	plans,
	...(ticketBodyBuild ? { ticketBodyBuild } : {}),
	...(handBuiltShipAuthorization ? { handBuiltShipAuthorization } : {}),
	...(shipRequest ? { shipRequest: { planIds: shipRequest, requestedAt: '2026-01-05T00:00:00.000Z' } } : {}),
	...(shipped ? { shipped: { at: '2026-02-01T00:00:00.000Z', planIds: shipRequest ?? [], mergeCommit } } : {}),
	history: [],
});

/** One record per line of the show table, in the order the table lists them. */
const setupEveryShipState = (): { records: WorkOrderState[] } => ({
	records: [
		recordWith({ mode: 'single-plan', plans: [planWith({ id: '001-record', progress: 'implemented' })], shipped: true }),
		recordWith({
			mode: 'multiple-plan',
			plans: [planWith({ id: '001-record', progress: 'implemented' }), planWith({ id: '002-queue-order', progress: 'implemented' })],
		}),
		recordWith({
			mode: 'multiple-plan',
			plans: [planWith({ id: '001-record', progress: 'implemented' }), planWith({ id: '002-queue-order', progress: 'implementing' })],
			shipRequest: ['001-record', '002-queue-order'],
		}),
		recordWith({ mode: 'single-plan', plans: [planWith({ id: '001-record', progress: 'ready' })] }),
		recordWith({ mode: 'single-plan', plans: [planWith({ id: '001-record', progress: 'implemented' })] }),
		recordWith({ mode: 'single-plan', plans: [planWith({ id: '001-record', progress: 'implemented', exclusionReason: 'replaced by a follow-up plan' })] }),
		recordWith({ mode: 'single-plan' }),
		recordWith({ mode: 'single-plan', ticketBodyBuild: buildWith({ runId: 'run-body-building', progress: 'implementing' }) }),
		recordWith({ mode: 'single-plan', ticketBodyBuild: buildWith({ runId: 'run-body-failed', progress: 'failed' }) }),
		recordWith({ mode: 'single-plan', ticketBodyBuild: buildWith({ runId: 'run-body-passed', progress: 'implemented' }) }),
		recordWith({ mode: 'single-plan', handBuiltShipAuthorization: authorization }),
	],
});

/** Single-plan records holding no plan 001 that carry an authorization beside a build at each progress. */
const setupAuthorizedBuilds = (): { records: WorkOrderState[] } => ({
	records: (['implemented', 'implementing', 'failed'] as const).map((progress) =>
		recordWith({
			mode: 'single-plan',
			ticketBodyBuild: buildWith({ runId: `run-body-${progress}`, progress }),
			handBuiltShipAuthorization: authorization,
		}),
	),
});

/** Shipped records still carrying what authorized them: an authorization, a passed build, and a ship request. */
const setupShippedRecords = (): { records: WorkOrderState[] } => ({
	records: [
		recordWith({ mode: 'single-plan', shipped: true, handBuiltShipAuthorization: authorization }),
		recordWith({ mode: 'single-plan', shipped: true, ticketBodyBuild: buildWith({ runId: 'run-body-passed', progress: 'implemented' }) }),
		recordWith({
			mode: 'multiple-plan',
			plans: [planWith({ id: '001-record', progress: 'implemented' }), planWith({ id: '002-queue-order', progress: 'implemented' })],
			shipRequest: ['001-record', '002-queue-order'],
			shipped: true,
		}),
	],
});

/** A drifted request beside a satisfied one on multiple-plan records. */
const setupShipRequests = (): { drifted: WorkOrderState; satisfied: WorkOrderState } => ({
	drifted: recordWith({
		mode: 'multiple-plan',
		plans: [
			planWith({ id: '001-record', progress: 'implemented' }),
			planWith({ id: '002-queue-order', progress: 'implementing' }),
			planWith({ id: '003-ship-guard', progress: 'ready' }),
			planWith({ id: '004-old-route', progress: 'ready', exclusionReason: 'folded into plan 002' }),
		],
		shipRequest: ['001-record', '002-queue-order', '004-old-route'],
	}),
	satisfied: recordWith({
		mode: 'multiple-plan',
		plans: [
			planWith({ id: '001-record', progress: 'implemented' }),
			planWith({ id: '002-queue-order', progress: 'implemented' }),
			planWith({ id: '003-ship-guard', progress: 'ready', exclusionReason: 'folded into plan 002' }),
		],
		shipRequest: ['001-record', '002-queue-order'],
	}),
});

describe('readWorkOrderShipState', () => {
	test('reads each mode and state of a record as its own ship state', () => {
		const { records } = setupEveryShipState();

		const states = records.map((record) => readWorkOrderShipState({ record }));

		expect(states).toStrictEqual([
			{ kind: 'shipped', mergeCommit },
			{ kind: 'ship-request-missing', includedPlanIds: ['001-record', '002-queue-order'] },
			{
				kind: 'ship-requested',
				planIds: ['001-record', '002-queue-order'],
				includedPlanIds: ['001-record', '002-queue-order'],
				missingPlanIds: [],
				stalePlanIds: [],
				waitingPlanId: '002-queue-order',
			},
			{ kind: 'plan-one-waiting', planId: '001-record' },
			{ kind: 'plan-one-implemented', planId: '001-record' },
			{ kind: 'plan-one-excluded', planId: '001-record', reason: 'replaced by a follow-up plan' },
			{ kind: 'ticket-body-unbuilt' },
			{ kind: 'ticket-body-building', runId: 'run-body-building' },
			{ kind: 'ticket-body-failed', runId: 'run-body-failed' },
			{ kind: 'ticket-body-passed', runId: 'run-body-passed' },
			{ kind: 'hand-built-authorized', by: 'Dana Reyes dana@example.com', at: '2026-01-07T00:00:00.000Z' },
		]);
	});

	test('reads a passed build ahead of a hand-built authorization, and an authorization ahead of a build that is implementing or failed', () => {
		const { records } = setupAuthorizedBuilds();

		const states = records.map((record) => readWorkOrderShipState({ record }));

		expect(states).toStrictEqual([
			{ kind: 'ticket-body-passed', runId: 'run-body-implemented' },
			{ kind: 'hand-built-authorized', by: 'Dana Reyes dana@example.com', at: '2026-01-07T00:00:00.000Z' },
			{ kind: 'hand-built-authorized', by: 'Dana Reyes dana@example.com', at: '2026-01-07T00:00:00.000Z' },
		]);
	});

	test('reads a shipped record as shipped whatever authorization, build or request it still carries', () => {
		const { records } = setupShippedRecords();

		const states = records.map((record) => readWorkOrderShipState({ record }));

		expect(states).toStrictEqual([
			{ kind: 'shipped', mergeCommit },
			{ kind: 'shipped', mergeCommit },
			{ kind: 'shipped', mergeCommit },
		]);
	});

	test('reads the plans a ship request misses, the plans it names that are no longer included, and the first included plan not yet implemented', () => {
		const { drifted, satisfied } = setupShipRequests();

		const states = [drifted, satisfied].map((record) => readWorkOrderShipState({ record }));

		// A satisfied request may leave waitingPlanId absent or undefined; both read as no plan waiting.
		const withWaiting = states.map((state) => ({ ...state, waitingPlanId: 'waitingPlanId' in state ? state.waitingPlanId : undefined }));

		expect(withWaiting).toStrictEqual([
			{
				kind: 'ship-requested',
				planIds: ['001-record', '002-queue-order', '004-old-route'],
				includedPlanIds: ['001-record', '002-queue-order', '003-ship-guard'],
				missingPlanIds: ['003-ship-guard'],
				stalePlanIds: ['004-old-route'],
				waitingPlanId: '002-queue-order',
			},
			{
				kind: 'ship-requested',
				planIds: ['001-record', '002-queue-order'],
				includedPlanIds: ['001-record', '002-queue-order'],
				missingPlanIds: [],
				stalePlanIds: [],
				waitingPlanId: undefined,
			},
		]);
	});
});
