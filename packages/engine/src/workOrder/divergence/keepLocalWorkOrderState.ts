import { WorkOrderSyncKeep } from '#src/common/constants/WorkOrderSyncKeep.ts';
import { pathExists } from '#src/common/paths/pathExists.ts';
import { formatPlanAddress } from '#src/common/planAddress/formatPlanAddress.ts';
import { sha256 } from '#src/common/sha256.ts';
import { workOrderFolderDir } from '#src/common/workspace/workOrderFolderDir.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig/LightsoutConfig.ts';
import type { WorkOrderState } from '#src/contracts/workOrder/WorkOrderState.ts';
import { planWorkspaceDir } from '#src/plan/planWorkspaceDir.ts';
import { publishPlan } from '#src/plan/publish/publishPlan/publishPlan.ts';
import { publishedButUnrecorded } from '#src/workOrder/common/constants/publishedButUnrecorded.ts';
import { workOrderFileNames } from '#src/workOrder/common/constants/workOrderFileNames.ts';
import { findDivergentPlanIds } from '#src/workOrder/common/findDivergentPlanIds.ts';
import { attachWorkOrderStateIfUnmoved } from '#src/workOrder/common/state/attachWorkOrderStateIfUnmoved.ts';
import { readPublishedWorkOrderState } from '#src/workOrder/common/state/readPublishedWorkOrderState.ts';
import { updateLocalWorkOrderState } from '#src/workOrder/common/state/updateLocalWorkOrderState.ts';
import { readWorkOrderSyncState } from '#src/workOrder/common/sync/readWorkOrderSyncState.ts';
import { recordWorkOrderSyncState } from '#src/workOrder/common/sync/recordWorkOrderSyncState.ts';
import type { PublishedWorkOrderState } from '#src/workOrder/common/types/PublishedWorkOrderState.ts';
import type { TicketTrackerTarget } from '#src/workOrder/common/types/TicketTrackerTarget.ts';
import { mergeOneSidedPlans } from '#src/workOrder/divergence/common/mergeOneSidedPlans.ts';
import { resolvePlanWorkingCheckout } from '#src/workOrder/divergence/common/resolvePlanWorkingCheckout.ts';
import { readWorkOrderState } from '#src/workOrder/readWorkOrderState.ts';

interface Params {
	/** Any checkout of the repository the command was launched from. */
	cwd: string;
	name: string;
	config: LightsoutConfig;
	env: NodeJS.ProcessEnv;
	target: TicketTrackerTarget;
	onProgress?: (message: string) => void;
}

interface PlanMarkers {
	recorded: Record<string, string>;
	/** Only what this machine itself just published, which is all the sidecar may claim. */
	published: Record<string, string>;
}

/**
 * Republishes so the kept record's markers describe files that are really
 * there. A plan this machine does not hold keeps the ticket's own marker, so the
 * record still describes the ticket's files truthfully.
 */
const republishDivergentPlans = async ({
	cwd,
	name,
	workOrderFolder,
	carried,
	kept,
	config,
	env,
	onProgress,
}: {
	cwd: string;
	name: string;
	workOrderFolder: string;
	carried: WorkOrderState | undefined;
	kept: WorkOrderState;
	config: LightsoutConfig;
	env: NodeJS.ProcessEnv;
	onProgress?: (message: string) => void;
}): Promise<PlanMarkers | { error: string }> => {
	const markers: PlanMarkers = { recorded: {}, published: {} };

	if (carried === undefined) {
		return markers;
	}

	const syncState = await readWorkOrderSyncState({ workOrderFolder });
	const planIds = findDivergentPlanIds({ record: carried, syncState }).filter((planId) => kept.plans.some((plan) => plan.id === planId));

	for (const planId of planIds) {
		const address = formatPlanAddress({ workOrderName: name, planId });
		const { checkout } = await resolvePlanWorkingCheckout({ cwd, name, planId });
		const held = await pathExists({ path: await planWorkspaceDir({ cwd: checkout, name: address }) });
		const publishedMarker = carried.plans.find((plan) => plan.id === planId)?.publishedMarker;

		if (!held) {
			onProgress?.(`plan ${planId} has no folder on this machine, so the ticket's own copy of it is left as it is and the kept record describes that copy`);

			if (publishedMarker !== undefined) {
				markers.recorded[planId] = publishedMarker;
			}

			continue;
		}

		const report = await publishPlan({ cwd: checkout, name: address, config, env, onProgress: onProgress ?? (() => undefined), titlePrefix: planId });

		if (report.error !== undefined) {
			return { error: `plan ${planId} could not be published over the ticket's copy, so the work order state was left alone: ${report.error}` };
		}

		if (report.markerSha256 !== undefined) {
			markers.recorded[planId] = report.markerSha256;
			markers.published[planId] = report.markerSha256;
		}
	}

	return markers;
};

const withPlanMarkers = ({ record, markers }: { record: WorkOrderState; markers: Record<string, string> }): WorkOrderState => ({
	...record,
	plans: record.plans.map((plan) => (markers[plan.id] === undefined ? plan : { ...plan, publishedMarker: markers[plan.id] })),
});

interface RecordsToKeep {
	kept: WorkOrderState;
	carried: PublishedWorkOrderState | undefined;
}

const readRecordsToKeep = async ({
	cwd,
	name,
	target,
}: {
	cwd: string;
	name: string;
	target: TicketTrackerTarget;
}): Promise<RecordsToKeep | { error: string }> => {
	const local = await readWorkOrderState({ cwd, name });

	if ('error' in local) {
		return local;
	}

	if (local.record === undefined) {
		return { error: `there is no ${workOrderFileNames.record} for '${name}' on this machine, so there is no local work order state to keep` };
	}

	const published = await readPublishedWorkOrderState({ target, name });

	if ('error' in published) {
		return published;
	}

	const carried = published.published;
	const kept =
		carried === undefined
			? local.record
			: mergeOneSidedPlans({ kept: local.record, other: carried.record, keptFrom: WorkOrderSyncKeep.Local, at: new Date().toISOString() });

	return 'error' in kept ? kept : { kept, carried };
};

/**
 * The plans are republished before the record, so a record naming a marker no
 * attachment matches is never left on the ticket. The record upload is guarded:
 * it overrides the published version the human looked at, never a later one, so
 * a third machine publishing mid-command is reported rather than overwritten.
 */
export const keepLocalWorkOrderState = async ({
	cwd,
	name,
	config,
	env,
	target,
	onProgress,
}: Params): Promise<{ record: WorkOrderState } | { error: string }> => {
	const records = await readRecordsToKeep({ cwd, name, target });

	if ('error' in records) {
		return records;
	}

	const { kept, carried } = records;
	const workOrderFolder = await workOrderFolderDir({ cwd, name });
	const markers = await republishDivergentPlans({
		cwd,
		name,
		workOrderFolder,
		carried: carried?.record,
		kept,
		config,
		env,
		onProgress,
	});

	if ('error' in markers) {
		return markers;
	}

	const applied = await updateLocalWorkOrderState({ cwd, name, change: () => withPlanMarkers({ record: kept, markers: markers.recorded }) });

	if ('error' in applied) {
		return applied;
	}

	const attached = await attachWorkOrderStateIfUnmoved({
		cwd,
		name,
		target,
		expectedPublishedSha256: carried === undefined ? undefined : sha256({ content: carried.content }),
		onProgress,
	});

	if ('error' in attached) {
		return attached;
	}

	const recorded = await recordWorkOrderSyncState({
		workOrderFolder,
		recordSha256: attached.attachedSha256,
		planMarkers: markers.published,
		failure: publishedButUnrecorded,
		dropSurfacedCopy: true,
	});

	return recorded === undefined ? { record: applied.record } : recorded;
};
