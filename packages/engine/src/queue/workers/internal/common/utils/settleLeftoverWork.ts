import { PlanProgress } from '#src/contracts/workOrder/PlanProgress.ts';
import type { WorkOrderPlanStep } from '#src/queue/workers/internal/common/types/WorkOrderPlanStep.ts';
import { commitPlanWork } from '#src/queue/workers/internal/common/utils/commitPlanWork.ts';

interface Params {
	/** The turn of the loop that is about to take a plan. Its `plan` is not what the leftovers are committed under. */
	step: WorkOrderPlanStep;
	/** The source paths already changed in the worktree before the loop built anything. */
	leftover: string[];
}

/**
 * Leftovers can only have come from the most recently implemented plan, whose
 * build a refused commit — or a human's `lightsout resume` — left uncommitted.
 * With no implemented plan they belong to nobody, so the ticket parks.
 *
 * @returns the one sentence saying why the loop stopped, or undefined once the tree is settled
 */
export const settleLeftoverWork = async ({ step, leftover }: Params): Promise<string | undefined> => {
	const { cwd, record } = step;

	if (leftover.length === 0) {
		return undefined;
	}

	const owner = record.plans
		.filter((plan) => plan.progress === PlanProgress.Implemented && plan.implementation?.finishedAt !== undefined)
		.sort((first, second) => Date.parse(second.implementation?.finishedAt ?? '') - Date.parse(first.implementation?.finishedAt ?? ''))
		.at(0);

	return owner === undefined
		? `the worktree ${cwd} holds changes no implemented plan of work order ${record.name} accounts for, so the queue cannot say which plan they belong to`
		: commitPlanWork({ step: { ...step, plan: owner } });
};
