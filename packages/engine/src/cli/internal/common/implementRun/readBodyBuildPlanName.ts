import { formatPlanAddress } from '#src/common/planAddress/formatPlanAddress.ts';
import { planNumberOf } from '#src/common/planAddress/planNumberOf.ts';
import { PlanProgress } from '#src/contracts/workOrder/PlanProgress.ts';
import { WorkOrderMode } from '#src/contracts/workOrder/WorkOrderMode.ts';
import { readWorkOrderState } from '#src/workOrder/readWorkOrderState.ts';

interface Params {
	/** The checkout the build happens in, whose primary checkout holds the ticket record. */
	cwd: string;
	/** The branch the build happens on, which names the ticket folder. Undefined when git could not name one. */
	branch: string | undefined;
}

/**
 * The plan a build from this branch's ticket body implements. Only single-plan
 * plan 001 ever does: in single-plan mode plan 001 alone supplies the ticket's
 * implementation, so the ship guard has to see a body build recorded against
 * it. A multiple-plan ticket builds every plan from its own deliverable.
 */
export const readBodyBuildPlanName = async ({ cwd, branch }: Params): Promise<string | { error: string } | undefined> => {
	if (branch === undefined) {
		return undefined;
	}

	const read = await readWorkOrderState({ cwd, name: branch });

	if ('error' in read) {
		return { error: read.error };
	}

	const record = read.record;

	if (record === undefined || record.mode !== WorkOrderMode.SinglePlan) {
		return undefined;
	}

	const first = record.plans.find((plan) => planNumberOf({ id: plan.id }) === 1 && plan.exclusion === undefined && plan.progress !== PlanProgress.Implemented);

	return first === undefined ? undefined : formatPlanAddress({ workOrderName: branch, planId: first.id });
};
