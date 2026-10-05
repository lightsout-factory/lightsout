import { PlanProgress } from '#src/contracts/workOrder/PlanProgress.ts';
import type { WorkOrderPlan } from '#src/contracts/workOrder/WorkOrderPlan.ts';
import type { WorkOrderState } from '#src/contracts/workOrder/WorkOrderState.ts';

interface Params {
	record: WorkOrderState;
	/** The plan the ordered build is about to take. */
	plan: WorkOrderPlan;
}

/**
 * `Implementing` is what a paused or interrupted run leaves. The queue never
 * retries a failed plan and never resumes a paused run, so the ticket parks for
 * a human.
 *
 * @returns the one sentence saying why the loop stopped, or undefined when the plan may be built
 */
export const findStalledPlanRefusal = ({ record, plan }: Params): string | undefined => {
	if (plan.progress !== PlanProgress.Failed && plan.progress !== PlanProgress.Implementing) {
		return undefined;
	}

	const finish = plan.implementation === undefined ? '' : `finish it with \`lightsout resume --run ${plan.implementation.runId}\`, or `;

	return `the implementation of plan ${plan.id} on work order ${record.name} has not finished, and a work order's plans implement in numeric order — ${finish}take it out of the order with \`lightsout work-order exclude-plan --name ${record.name} --plan ${plan.id}\``;
};
