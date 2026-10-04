import { WorkOrderSyncKeep } from '#src/common/constants/WorkOrderSyncKeep.ts';
import { sha256 } from '#src/common/sha256.ts';
import { workOrderFolderDir } from '#src/common/workspace/workOrderFolderDir.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig/LightsoutConfig.ts';
import type { WorkOrderState } from '#src/contracts/workOrder/WorkOrderState.ts';
import { publishedButUnrecorded } from '#src/workOrder/common/constants/publishedButUnrecorded.ts';
import { workOrderFileNames } from '#src/workOrder/common/constants/workOrderFileNames.ts';
import { readWorkOrderWithTrackerTarget } from '#src/workOrder/common/readWorkOrderWithTrackerTarget.ts';
import { attachWorkOrderStateIfUnmoved } from '#src/workOrder/common/state/attachWorkOrderStateIfUnmoved.ts';
import { serializeWorkOrderState } from '#src/workOrder/common/state/serializeWorkOrderState.ts';
import { readWorkOrderSyncState } from '#src/workOrder/common/sync/readWorkOrderSyncState.ts';
import { recordWorkOrderSyncState } from '#src/workOrder/common/sync/recordWorkOrderSyncState.ts';
import type { TicketTrackerTarget } from '#src/workOrder/common/types/TicketTrackerTarget.ts';
import { keepLocalWorkOrderState } from '#src/workOrder/divergence/keepLocalWorkOrderState.ts';
import { keepPublishedWorkOrderState } from '#src/workOrder/divergence/keepPublishedWorkOrderState.ts';
import { pullWorkOrderState } from '#src/workOrder/pullWorkOrderState.ts';

interface Params {
	/** Any checkout of the repository the command was launched from. */
	cwd: string;
	name: string;
	config: LightsoutConfig;
	env: NodeJS.ProcessEnv;
	/** Which copy the human chose, when a divergence has already been surfaced. Absent asks for the ordinary pull-and-catch-up. */
	keep: WorkOrderSyncKeep | undefined;
	onProgress?: (message: string) => void;
}

/** This is how a failed earlier publish is retried: the sidecar still names older bytes than the record. */
const catchUpTicketRecord = async ({
	cwd,
	name,
	config,
	env,
	target,
	onProgress,
}: {
	cwd: string;
	name: string;
	config: LightsoutConfig;
	env: NodeJS.ProcessEnv;
	target: TicketTrackerTarget;
	onProgress?: (message: string) => void;
}): Promise<{ record: WorkOrderState } | { error: string }> => {
	const pulled = await pullWorkOrderState({ cwd, name, config, env, onProgress });

	if ('error' in pulled) {
		return pulled;
	}

	if (pulled.record === undefined) {
		return { error: `there is no ${workOrderFileNames.record} for '${name}' on this machine or on ${target.ticketRef}, so there is nothing to sync` };
	}

	const workOrderFolder = await workOrderFolderDir({ cwd, name });
	const syncState = await readWorkOrderSyncState({ workOrderFolder });
	const localSha256 = sha256({ content: serializeWorkOrderState({ record: pulled.record }) });

	if (localSha256 === syncState?.recordSha256) {
		onProgress?.(`the work order state for '${name}' already matches the copy on ${target.ticketRef}`);

		return { record: pulled.record };
	}

	const attached = await attachWorkOrderStateIfUnmoved({ cwd, name, target, expectedPublishedSha256: syncState?.recordSha256, onProgress });

	if ('error' in attached) {
		return attached;
	}

	const recorded = await recordWorkOrderSyncState({ workOrderFolder, recordSha256: attached.attachedSha256, failure: publishedButUnrecorded });

	return recorded === undefined ? { record: pulled.record } : recorded;
};

/**
 * A work order with nowhere to publish to is refused rather than answered from local files, because
 * syncing is the one command whose subject is the tracker. `--keep` is the only way a divergence is resolved.
 */
export const syncWorkOrderState = async ({ cwd, name, config, env, keep, onProgress }: Params): Promise<{ record: WorkOrderState } | { error: string }> => {
	const opened = await readWorkOrderWithTrackerTarget({ cwd, name, config, env });

	if ('error' in opened) {
		return opened;
	}

	const { record, target } = opened;

	if ('localOnly' in target) {
		// A work order with no record at all has nothing to sync, rather than
		// nowhere to publish: the ticket it belongs to is what the record would
		// have said, so no tracker can be asked on its behalf.
		return record === undefined
			? { error: `there is no ${workOrderFileNames.record} for '${name}' on this machine, so there is nothing to sync` }
			: { error: `${target.localOnly} — \`lightsout work-order sync\` needs a configured tracker to sync against` };
	}

	if (keep === WorkOrderSyncKeep.Published) {
		return keepPublishedWorkOrderState({ cwd, name, config, env, target, onProgress });
	}

	if (keep === WorkOrderSyncKeep.Local) {
		return keepLocalWorkOrderState({ cwd, name, config, env, target, onProgress });
	}

	return catchUpTicketRecord({ cwd, name, config, env, target, onProgress });
};
