import { planNumberOf } from '#src/common/planAddress/planNumberOf.ts';
import { WorkOrderMode } from '#src/contracts/workOrder/WorkOrderMode.ts';
import type { WorkOrderState } from '#src/contracts/workOrder/WorkOrderState.ts';

interface Params {
	record: WorkOrderState;
}

/**
 * An excluded plan 001 still counts as held, because the single-plan ship rule still refuses it by
 * name. The queue and the body-build lifecycle both decide from this one fact, so they never disagree.
 */
export const isPlanlessWorkOrder = ({ record }: Params): boolean =>
	record.mode === WorkOrderMode.SinglePlan && !record.plans.some((plan) => planNumberOf({ id: plan.id }) === 1);
