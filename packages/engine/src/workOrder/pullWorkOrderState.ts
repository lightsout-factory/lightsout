import { join } from 'node:path';
import { messageOf } from '#src/common/utils/messageOf.ts';
import { sha256 } from '#src/common/utils/sha256.ts';
import { workOrderFolderDir } from '#src/common/workspace/workOrderFolderDir.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig/LightsoutConfig.ts';
import type { WorkOrderState } from '#src/contracts/workOrder/WorkOrderState.ts';
import { workOrderFileNames } from '#src/workOrder/internal/common/constants/workOrderFileNames.ts';
import type { PublishedWorkOrderState } from '#src/workOrder/internal/common/types/PublishedWorkOrderState.ts';
import { readPublishedWorkOrderState } from '#src/workOrder/internal/common/utils/readPublishedWorkOrderState.ts';
import { readWorkOrderSyncState } from '#src/workOrder/internal/common/utils/readWorkOrderSyncState.ts';
import { readWorkOrderWithTrackerTarget } from '#src/workOrder/internal/common/utils/readWorkOrderWithTrackerTarget.ts';
import { serializeWorkOrderState } from '#src/workOrder/internal/common/utils/serializeWorkOrderState.ts';
import { surfaceWorkOrderDivergence } from '#src/workOrder/internal/common/utils/surfaceWorkOrderDivergence.ts';
import { updateWorkOrderSyncState } from '#src/workOrder/internal/common/utils/updateWorkOrderSyncState.ts';
import { withWorkOrderStateLock } from '#src/workOrder/internal/common/utils/withWorkOrderStateLock.ts';
import { writeWorkOrderFolderFile } from '#src/workOrder/internal/common/utils/writeWorkOrderFolderFile.ts';
import { readWorkOrderState } from '#src/workOrder/readWorkOrderState.ts';

interface Params {
	/** Any checkout of the repository: the one record this machine holds is found from it. */
	cwd: string;
	/** The work order's label, which is also the branch its plans implement on. */
	name: string;
	config: LightsoutConfig;
	env: NodeJS.ProcessEnv;
	onProgress?: (message: string) => void;
}

const takePublished = async ({
	workOrderFolder,
	content,
	record,
	ticketRef,
	onProgress,
}: {
	workOrderFolder: string;
	content: Buffer;
	record: WorkOrderState;
	ticketRef: string;
	onProgress?: (message: string) => void;
}) => {
	let outcome: { record: WorkOrderState } | { error: string };

	try {
		await writeWorkOrderFolderFile({ path: join(workOrderFolder, workOrderFileNames.record), content });
		await updateWorkOrderSyncState({ workOrderFolder, recordSha256: sha256({ content }) });

		outcome = { record };
	} catch (error) {
		outcome = { error: `the ${workOrderFileNames.record} published on ${ticketRef} could not be written into ${workOrderFolder}: ${messageOf({ error })}` };
	}

	if ('record' in outcome) {
		onProgress?.(`took the work order state published on ${ticketRef}`);
	}

	return outcome;
};

/** Compares normalised record bytes, not fields, against the sidecar's note of what this machine last published or restored. */
const applyThreeWayRule = async ({
	cwd,
	workOrderFolder,
	name,
	ticketRef,
	published,
	onProgress,
}: {
	cwd: string;
	workOrderFolder: string;
	name: string;
	ticketRef: string;
	published: PublishedWorkOrderState | undefined;
	onProgress?: (message: string) => void;
}): Promise<{ record: WorkOrderState | undefined } | { error: string }> => {
	const local = await readWorkOrderState({ cwd, name });

	if ('error' in local) {
		return local;
	}

	if (published === undefined) {
		return { record: local.record };
	}

	const syncState = await readWorkOrderSyncState({ workOrderFolder });
	const publishedSha256 = sha256({ content: published.content });
	const localSha256 = local.record === undefined ? undefined : sha256({ content: serializeWorkOrderState({ record: local.record }) });
	const take = () => takePublished({ workOrderFolder, content: published.content, record: published.record, ticketRef, onProgress });
	let outcome: { record: WorkOrderState | undefined } | { error: string };

	if (local.record === undefined || localSha256 === syncState?.recordSha256) {
		// Nothing local to lose, or only the ticket moved since the last sync.
		outcome = await take();
	} else if (localSha256 === publishedSha256) {
		// The two agree however they got there; recording the hash is what makes
		// the next change on either side answerable rather than a divergence.
		outcome = syncState?.recordSha256 === publishedSha256 ? { record: local.record } : await take();
	} else if (publishedSha256 === syncState?.recordSha256) {
		// Only this machine moved: its copy stands, and nothing is written.
		outcome = { record: local.record };
	} else {
		outcome = { error: await surfaceWorkOrderDivergence({ workOrderFolder, name, ticketRef, content: published.content }) };
	}

	return outcome;
};

/**
 * A configured tracker that cannot be read is an error rather than a quiet local-only answer,
 * because passing over it would hide a divergence. The tracker is read before the lock is taken:
 * holding the lock across a network call would stall every other command on this machine.
 */
export const pullWorkOrderState = async ({
	cwd,
	name,
	config,
	env,
	onProgress,
}: Params): Promise<{ record: WorkOrderState | undefined } | { error: string }> => {
	const opened = await readWorkOrderWithTrackerTarget({ cwd, name, config, env });

	if ('error' in opened) {
		return opened;
	}

	const { record, target } = opened;

	if ('localOnly' in target) {
		return { record };
	}

	const published = await readPublishedWorkOrderState({ target, name });

	if ('error' in published) {
		return published;
	}

	const workOrderFolder = await workOrderFolderDir({ cwd, name });

	return withWorkOrderStateLock({
		workOrderFolder,
		run: () => applyThreeWayRule({ cwd, workOrderFolder, name, ticketRef: target.ticketRef, published: published.published, onProgress }),
	});
};
