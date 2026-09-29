import { parsePlanAddress } from '#src/common/planAddress/parsePlanAddress.ts';
import { workOrderFolderDir } from '#src/common/workspace/workOrderFolderDir.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig.ts';
import { PlanProgress } from '#src/contracts/workOrder/PlanProgress.ts';
import type { WorkOrderState } from '#src/contracts/workOrder/WorkOrderState.ts';
import { publishPlan } from '#src/plan/publish/publishPlan.ts';
import { workOrderFileNames } from '#src/workOrder/internal/common/constants/workOrderFileNames.ts';
import type { TicketTrackerTarget } from '#src/workOrder/internal/common/types/TicketTrackerTarget.ts';
import { findPlanPublishRefusal } from '#src/workOrder/internal/common/utils/findPlanPublishRefusal.ts';
import { publishBrainstormWhenNotesChanged } from '#src/workOrder/internal/common/utils/publishBrainstormWhenNotesChanged.ts';
import { readWorkOrderSyncState } from '#src/workOrder/internal/common/utils/readWorkOrderSyncState.ts';
import { readWorkOrderWithTrackerTarget } from '#src/workOrder/internal/common/utils/readWorkOrderWithTrackerTarget.ts';
import { recordWorkOrderSyncState } from '#src/workOrder/internal/common/utils/recordWorkOrderSyncState.ts';
import { pullWorkOrderState } from '#src/workOrder/pullWorkOrderState.ts';
import { updateSyncedWorkOrderState } from '#src/workOrder/updateSyncedWorkOrderState.ts';

interface Params {
	cwd: string;
	/** The plan's address, `<ticket-branch>/<plan-id>`. */
	address: string;
	config: LightsoutConfig;
	env: NodeJS.ProcessEnv;
	onProgress: (message: string) => void;
}

interface TicketPlanPublishReport {
	/** The ticket the files landed on, e.g. 'LO-140'. Absent when nothing was published. */
	ticketRef?: string;
	/** Every attachment title this run wrote, in attach order, ending with the work order state. */
	published: string[];
	/** Titles under this plan's own prefix from an earlier publish that this run did not write. Reported, never deleted. */
	stale: string[];
	error?: string;
	/** Set when the plan's files landed but `state.json` does not say so. */
	recordError?: string;
}

const recordPublishedPlan =
	({ planId, markerSha256, name }: { planId: string; markerSha256: string; name: string }) =>
	(current: WorkOrderState | undefined): WorkOrderState | { error: string } => {
		const plan = current?.plans.find((entry) => entry.id === planId);

		if (current === undefined || plan === undefined) {
			return { error: `the work order state for '${name}' no longer holds plan ${planId}, so the publish could not be recorded` };
		}

		return {
			...current,
			plans: current.plans.map((entry) =>
				entry.id === planId
					? { ...entry, publishedMarker: markerSha256, progress: entry.progress === PlanProgress.Planning ? PlanProgress.Ready : entry.progress }
					: entry,
			),
		};
	};

const recordMarkerLocally = async ({ cwd, name, planId, markerSha256 }: { cwd: string; name: string; planId: string; markerSha256: string }) =>
	recordWorkOrderSyncState({
		workOrderFolder: await workOrderFolderDir({ cwd, name }),
		planMarkers: { [planId]: markerSha256 },
		failure: `plan ${planId} was published, but this machine could not record which generation it sent`,
	});

/**
 * The sidecar is written only once the record carries the marker, so an interrupted publish leaves
 * both naming the old generation: a plan that can be published again rather than one that looks divergent.
 */
const recordPlanPublish = async ({
	cwd,
	name,
	planId,
	markerSha256,
	config,
	env,
	onProgress,
}: {
	cwd: string;
	name: string;
	planId: string;
	markerSha256: string;
	config: LightsoutConfig;
	env: NodeJS.ProcessEnv;
	onProgress: (message: string) => void;
}): Promise<{ published: string[]; recordError?: string }> => {
	const recorded = await updateSyncedWorkOrderState({
		cwd,
		name,
		config,
		env,
		change: recordPublishedPlan({ planId, markerSha256, name }),
		onProgress,
	});

	if ('error' in recorded) {
		return { published: [], recordError: recorded.error };
	}

	if (recorded.publishError !== undefined) {
		return { published: [], recordError: recorded.publishError };
	}

	const remembered = await recordMarkerLocally({ cwd, name, planId, markerSha256 });
	const landed = [workOrderFileNames.record];

	return remembered === undefined ? { published: landed } : { published: landed, recordError: remembered.error };
};

const publishGenerations = async ({
	cwd,
	address,
	planId,
	name,
	target,
	config,
	env,
	onProgress,
}: {
	cwd: string;
	address: string;
	planId: string;
	name: string;
	target: TicketTrackerTarget;
	config: LightsoutConfig;
	env: NodeJS.ProcessEnv;
	onProgress: (message: string) => void;
}): Promise<TicketPlanPublishReport> => {
	const report: TicketPlanPublishReport = { ticketRef: target.ticketRef, published: [], stale: [] };
	const brainstorm = await publishBrainstormWhenNotesChanged({ cwd, address, planId, target, config, env, onProgress });

	if ('error' in brainstorm) {
		report.error = brainstorm.error;
	} else {
		report.published.push(...brainstorm.published);

		const plan = await publishPlan({ cwd, name: address, config, env, onProgress, titlePrefix: planId });

		report.published.push(...plan.published);
		report.stale = plan.stale;

		if (plan.error !== undefined || plan.markerSha256 === undefined) {
			report.error = plan.error ?? `plan ${planId} was published without a commit marker, so the work order state cannot name the generation that landed`;
		} else {
			const recorded = await recordPlanPublish({ cwd, name, planId, markerSha256: plan.markerSha256, config, env, onProgress });

			report.published.push(...recorded.published);

			if (recorded.recordError !== undefined) {
				report.recordError = recorded.recordError;
			}
		}
	}

	return report;
};

/**
 * Notes go first because the plan generation does not carry them. The record goes last because it
 * names the plan generation's marker, and a record naming a marker no attachment matches looks
 * divergent to every other machine.
 */
export const publishWorkOrderPlan = async ({ cwd, address, config, env, onProgress }: Params): Promise<TicketPlanPublishReport> => {
	const parsed = parsePlanAddress({ name: address });

	if (parsed === undefined) {
		return { published: [], stale: [], error: `'${address}' is not a plan address — a plan of a ticket is named as '<ticket-branch>/<plan-id>'` };
	}

	const { workOrderName: name, planId } = parsed;
	const opened = await readWorkOrderWithTrackerTarget({ cwd, name, config, env });

	if ('error' in opened) {
		return { published: [], stale: [], error: opened.error };
	}

	const { target } = opened;

	if ('localOnly' in target) {
		return { published: [], stale: [], error: `plan ${planId} cannot be published: ${target.localOnly}` };
	}

	const pulled = await pullWorkOrderState({ cwd, name, config, env, onProgress });

	if ('error' in pulled) {
		return { ticketRef: target.ticketRef, published: [], stale: [], error: pulled.error };
	}

	const syncState = await readWorkOrderSyncState({ workOrderFolder: await workOrderFolderDir({ cwd, name }) });
	const refusal = await findPlanPublishRefusal({ cwd, address, planId, name, record: pulled.record, syncState });

	if (refusal !== undefined) {
		return { ticketRef: target.ticketRef, published: [], stale: [], error: refusal };
	}

	return publishGenerations({ cwd, address, planId, name, target, config, env, onProgress });
};
