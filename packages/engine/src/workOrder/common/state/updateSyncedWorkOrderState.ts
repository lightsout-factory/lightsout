import { workOrderFolderDir } from '#src/common/workspace/workOrderFolderDir.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig/LightsoutConfig.ts';
import type { WorkOrderState } from '#src/contracts/workOrder/WorkOrderState.ts';
import { publishedButUnrecorded } from '#src/workOrder/common/constants/publishedButUnrecorded.ts';
import { resolveWorkOrderTrackerTarget } from '#src/workOrder/common/resolveWorkOrderTrackerTarget.ts';
import { attachWorkOrderStateIfUnmoved } from '#src/workOrder/common/state/attachWorkOrderStateIfUnmoved.ts';
import { updateLocalWorkOrderState } from '#src/workOrder/common/state/updateLocalWorkOrderState.ts';
import { readWorkOrderSyncState } from '#src/workOrder/common/sync/readWorkOrderSyncState.ts';
import { recordWorkOrderSyncState } from '#src/workOrder/common/sync/recordWorkOrderSyncState.ts';
import { pullWorkOrderState } from '#src/workOrder/pullWorkOrderState.ts';

interface Params {
	/** Any checkout of the repository: the one record this machine holds is found from it. */
	cwd: string;
	name: string;
	config: LightsoutConfig;
	env: NodeJS.ProcessEnv;
	/** The same pure change `updateLocalWorkOrderState` takes, run under the record's lock once the pull has settled what "now" is. */
	change: (current: WorkOrderState | undefined) => WorkOrderState | { error: string };
	onProgress?: (message: string) => void;
}

/**
 * The pull runs first so the change is made against what the ticket carries, and a divergence stops
 * everything before the change runs. A change that reached disk but not the tracker is a
 * `publishError`, not a failure: it has happened locally, and a failure would invite making it
 * twice. The sidecar is left as it was, so the next `lightsout work-order sync` retries.
 */
export const updateSyncedWorkOrderState = async ({
	cwd,
	name,
	config,
	env,
	change,
	onProgress,
}: Params): Promise<{ record: WorkOrderState; publishError?: string } | { error: string }> => {
	const pulled = await pullWorkOrderState({ cwd, name, config, env, onProgress });

	if ('error' in pulled) {
		return pulled;
	}

	const updated = await updateLocalWorkOrderState({ cwd, name, change });

	if ('error' in updated) {
		return updated;
	}

	const target = resolveWorkOrderTrackerTarget({ config, env, workOrderName: name, ticketRef: updated.record.ticketRef });

	// A tracker that cannot be used at all was already answered by the pull, so
	// what is left here is a work order with nowhere to publish to — which the
	// record it just wrote is the only thing that can say.
	if ('error' in target || 'localOnly' in target) {
		return { record: updated.record };
	}

	const workOrderFolder = await workOrderFolderDir({ cwd, name });
	const syncState = await readWorkOrderSyncState({ workOrderFolder });
	const attached = await attachWorkOrderStateIfUnmoved({
		cwd,
		name,
		target,
		expectedPublishedSha256: syncState?.recordSha256,
		onProgress,
	});

	if ('error' in attached) {
		return { record: updated.record, publishError: attached.error };
	}

	const recorded = await recordWorkOrderSyncState({
		workOrderFolder,
		recordSha256: attached.attachedSha256,
		failure: publishedButUnrecorded,
	});

	return recorded === undefined ? { record: updated.record } : { record: updated.record, publishError: recorded.error };
};
