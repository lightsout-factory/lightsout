import type { BodyBuildTarget } from '#src/cli/implementDirectCommand/common/types/BodyBuildTarget.ts';
import { formatPlanAddress } from '#src/common/planAddress/formatPlanAddress.ts';
import { planNumberOf } from '#src/common/planAddress/planNumberOf.ts';
import { PlanProgress } from '#src/contracts/workOrder/PlanProgress.ts';
import { WorkOrderMode } from '#src/contracts/workOrder/WorkOrderMode.ts';
import { isPlanlessWorkOrder } from '#src/workOrder/isPlanlessWorkOrder.ts';
import { readWorkOrderState } from '#src/workOrder/readWorkOrderState.ts';

interface Params {
	/** The checkout the build happens in, whose primary checkout holds the ticket record. */
	cwd: string;
	/** The branch the build happens on, which names the ticket folder. Undefined when git could not name one. */
	branch: string | undefined;
}

/**
 * What a build from this branch's ticket body is recorded against. Only a
 * single-plan ticket's build is ever recorded, because there the ship guard
 * reads it: against plan 001 when the record holds one, and against the work
 * order itself when it holds none. A multiple-plan ticket builds every plan
 * from its own deliverable.
 */
export const readBodyBuildTarget = async ({ cwd, branch }: Params): Promise<BodyBuildTarget | { error: string } | undefined> => {
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

	if (isPlanlessWorkOrder({ record })) {
		return { workOrderName: record.name };
	}

	const first = record.plans.find((plan) => planNumberOf({ id: plan.id }) === 1 && plan.exclusion === undefined && plan.progress !== PlanProgress.Implemented);

	return first === undefined ? undefined : { planName: formatPlanAddress({ workOrderName: branch, planId: first.id }) };
};
