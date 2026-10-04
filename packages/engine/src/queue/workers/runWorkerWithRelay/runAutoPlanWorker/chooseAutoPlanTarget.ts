import { formatPlanAddress } from '#src/common/planAddress/formatPlanAddress.ts';
import { toBranchSlug } from '#src/common/toBranchSlug.ts';
import type { TicketSummary } from '#src/common/types/TicketSummary.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig/LightsoutConfig.ts';
import type { WorkOrderState } from '#src/contracts/workOrder/WorkOrderState.ts';
import { addWorkOrderPlan } from '#src/workOrder/addWorkOrderPlan/addWorkOrderPlan.ts';
import { findNextPlanToPlan } from '#src/workOrder/findNextPlanToPlan.ts';
import { pullWorkOrderState } from '#src/workOrder/pullWorkOrderState.ts';

interface Params {
	/** The work order's worktree, where a first plan's folder is created. */
	cwd: string;
	/** The work order's label — the folder its record is keyed by, and the first segment of every address built here. */
	workOrderName: string;
	ticket: TicketSummary;
	config: LightsoutConfig;
	/** The process environment the tracker credentials are read from. */
	env: NodeJS.ProcessEnv;
	onProgress?: (message: string) => void;
}

/**
 * Uses the branch slugger so a plan's folder never drifts from how a branch is
 * named; three of its words always satisfy the plan-id slug rule. An empty slug
 * is not a plan id, hence the fallback.
 */
const toFirstPlanSlug = ({ title }: { title: string }) => {
	const words = toBranchSlug({ text: title }).split('-').filter(Boolean).slice(0, 3);

	return words.length === 0 ? 'plan' : words.join('-');
};

const addFirstPlan = async ({ cwd, workOrderName, ticket, config, env, onProgress }: Params) => {
	const added = await addWorkOrderPlan({
		cwd,
		name: workOrderName,
		slug: toFirstPlanSlug({ title: ticket.title }),
		title: ticket.title,
		config,
		env,
		onProgress,
	});

	if ('error' in added) {
		return added;
	}

	for (const message of [added.notice, added.publishError].filter((entry) => entry !== undefined)) {
		onProgress?.(message);
	}

	return { record: added.record, address: added.address };
};

/**
 * Decided by the engine before the session starts, so the session never derives
 * a name. The address is built from the work order's label, because a prefixed
 * branch would yield an address `parsePlanAddress` rejects.
 *
 * A work order with no record is a refusal rather than something to create:
 * `lightsout work-order new` is the one writer of a work order's name.
 *
 * @returns the record and the plan address, the record alone when nothing is waiting to be planned, or the refusal to pass along
 */
export const chooseAutoPlanTarget = async (params: Params): Promise<{ record: WorkOrderState; address?: string } | { error: string }> => {
	const { cwd, workOrderName, config, env, onProgress } = params;
	const pulled = await pullWorkOrderState({ cwd, name: workOrderName, config, env, onProgress });

	if ('error' in pulled) {
		return pulled;
	}

	if (pulled.record === undefined) {
		return {
			error: `no work order is named ${workOrderName}, so there is no record to plan against — create one with \`lightsout work-order new --ticket <ref>\``,
		};
	}

	const { record } = pulled;

	if (record.plans.length === 0) {
		return addFirstPlan(params);
	}

	const waiting = findNextPlanToPlan({ record });

	return waiting === undefined ? { record } : { record, address: formatPlanAddress({ workOrderName, planId: waiting.id }) };
};
