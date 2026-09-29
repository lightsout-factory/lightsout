import { PlanProgress } from '#src/contracts/workOrder/PlanProgress.ts';
import type { WorkOrderPlan } from '#src/contracts/workOrder/WorkOrderPlan.ts';
import type { WorkOrderState } from '#src/contracts/workOrder/WorkOrderState.ts';

interface Params {
	record: WorkOrderState;
}

/**
 * Lowest-first, the order building follows, so the plan a session writes is the one the build loop
 * takes up next. It lives here because the queue and the board both apply it, and two copies could
 * disagree.
 */
export const findNextPlanToPlan = ({ record }: Params): WorkOrderPlan | undefined =>
	record.plans.find((plan) => plan.exclusion === undefined && plan.progress === PlanProgress.Planning);
