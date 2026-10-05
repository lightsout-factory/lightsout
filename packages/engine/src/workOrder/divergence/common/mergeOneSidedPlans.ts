import { WorkOrderSyncKeep } from '#src/common/constants/WorkOrderSyncKeep.ts';
import { planNumberOf } from '#src/common/planAddress/planNumberOf.ts';
import { WorkOrderEventKind } from '#src/contracts/workOrder/WorkOrderEventKind.ts';
import type { WorkOrderState } from '#src/contracts/workOrder/WorkOrderState.ts';

interface Params {
	kept: WorkOrderState;
	other: WorkOrderState;
	keptFrom: WorkOrderSyncKeep;
	at: string;
}

/**
 * Settling a divergence must never lose a plan or free its number for reuse.
 * Each carry appends a `plan-added` event, because the kept record's history has
 * no other way to explain how the plan got there. Two different plans under one
 * number refuse rather than choose, and the human decides.
 */
export const mergeOneSidedPlans = ({ kept, other, keptFrom, at }: Params): WorkOrderState | { error: string } => {
	const source = keptFrom === WorkOrderSyncKeep.Local ? WorkOrderSyncKeep.Published : WorkOrderSyncKeep.Local;
	const held = new Map(kept.plans.map((plan) => [planNumberOf({ id: plan.id }), plan]));
	const carried: WorkOrderState['plans'] = [];

	for (const plan of other.plans) {
		const sameNumber = held.get(planNumberOf({ id: plan.id }));

		if (sameNumber === undefined) {
			carried.push(plan);
		} else if (sameNumber.id !== plan.id) {
			return {
				error: `the local and published copies of the work order state both use plan number ${plan.id.slice(0, 3)}, for '${keptFrom === WorkOrderSyncKeep.Local ? sameNumber.id : plan.id}' here and for '${keptFrom === WorkOrderSyncKeep.Local ? plan.id : sameNumber.id}' on the ticket — no kept record can hold both, so rename or remove one of them before syncing`,
			};
		}
	}

	if (carried.length === 0) {
		return kept;
	}

	return {
		...kept,
		plans: [...kept.plans, ...carried].sort((left, right) => planNumberOf({ id: left.id }) - planNumberOf({ id: right.id })),
		history: [
			...kept.history,
			...carried.map((plan) => ({
				at,
				kind: WorkOrderEventKind.PlanAdded,
				detail: `carried plan ${plan.id} over from the ${source} copy of the work order state while keeping the ${keptFrom} copy`,
			})),
		],
	};
};
