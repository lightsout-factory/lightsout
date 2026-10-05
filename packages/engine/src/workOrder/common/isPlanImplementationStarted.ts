import { PlanProgress } from '#src/contracts/workOrder/PlanProgress.ts';
import type { WorkOrderPlan } from '#src/contracts/workOrder/WorkOrderPlan.ts';

interface Params {
	plan: WorkOrderPlan;
}

/**
 * Decided by progress, not the `implementation` block: a plan made from an
 * already-built folder carries no block but its implementation still started.
 */
export const isPlanImplementationStarted = ({ plan }: Params): boolean =>
	plan.progress === PlanProgress.Implementing || plan.progress === PlanProgress.Implemented || plan.progress === PlanProgress.Failed;
