import { sha256 } from '#src/common/utils/sha256.ts';
import { workOrderFolderDir } from '#src/common/workspace/workOrderFolderDir.ts';
import { getTicketsByIdentifiers } from '#src/ticketTracker/getTicketsByIdentifiers.ts';
import { setTicketAttachment } from '#src/ticketTracker/setTicketAttachment.ts';
import { workOrderFileNames } from '#src/workOrder/internal/common/constants/workOrderFileNames.ts';
import type { TicketTrackerTarget } from '#src/workOrder/internal/common/types/TicketTrackerTarget.ts';
import { readPublishedWorkOrderState } from '#src/workOrder/internal/common/utils/readPublishedWorkOrderState.ts';
import { readWorkOrderSyncState } from '#src/workOrder/internal/common/utils/readWorkOrderSyncState.ts';
import { serializeWorkOrderState } from '#src/workOrder/internal/common/utils/serializeWorkOrderState.ts';
import { surfaceWorkOrderDivergence } from '#src/workOrder/internal/common/utils/surfaceWorkOrderDivergence.ts';
import { withWorkOrderStateLock } from '#src/workOrder/internal/common/utils/withWorkOrderStateLock.ts';
import { readWorkOrderState } from '#src/workOrder/readWorkOrderState.ts';

interface Params {
	/** Any checkout of the repository. */
	cwd: string;
	name: string;
	target: TicketTrackerTarget;
	/** Undefined when the ticket carried none. */
	expectedPublishedSha256: string | undefined;
	onProgress?: (message: string) => void;
}

interface AttachParams {
	target: TicketTrackerTarget;
	/** The record's bytes, exactly as `serializeWorkOrderState` wrote them. */
	content: Buffer;
	onProgress?: (message: string) => void;
}

/** Private to this file: an unguarded attach would overwrite a record another machine published since the pull. */
const attachTicketRecord = async ({ target, content, onProgress }: AttachParams): Promise<{ error: string } | undefined> => {
	const { settings, ticketRef } = target;
	const tickets = await getTicketsByIdentifiers({ settings, identifiers: [ticketRef] });

	if ('error' in tickets) {
		return { error: `the work order state could not be published: ${tickets.error}` };
	}

	const ticket = tickets.at(0);

	if (ticket === undefined) {
		return { error: `the work order state could not be published: there is no ${ticketRef} on the configured ticket tracker` };
	}

	const failure = await setTicketAttachment({ settings, ticketId: ticket.id, title: workOrderFileNames.record, content, contentType: 'application/json' });

	if (failure !== undefined) {
		return { error: `the work order state could not be published: ${failure.error}` };
	}

	onProgress?.(`attached ${workOrderFileNames.record} to ${ticketRef}`);

	return undefined;
};

/**
 * Trackers offer no compare-and-swap, so re-reading right before the attach
 * narrows the window in which another machine's publish could be overwritten.
 *
 * The local record is read here rather than taken from the caller, so an older
 * copy in flight cannot undo a newer command on this machine. The sidecar's hash
 * is accepted too: this machine published those bytes itself.
 */
export const attachWorkOrderStateIfUnmoved = async ({
	cwd,
	name,
	target,
	expectedPublishedSha256,
	onProgress,
}: Params): Promise<{ attachedSha256: string } | { error: string }> => {
	const published = await readPublishedWorkOrderState({ target, name });

	if ('error' in published) {
		return published;
	}

	const local = await readWorkOrderState({ cwd, name });

	if ('error' in local) {
		return local;
	}

	if (local.record === undefined) {
		return { error: `there is no ${workOrderFileNames.record} for '${name}' on this machine to publish` };
	}

	const workOrderFolder = await workOrderFolderDir({ cwd, name });
	const syncState = await readWorkOrderSyncState({ workOrderFolder });
	const content = serializeWorkOrderState({ record: local.record });
	const attachedSha256 = sha256({ content });
	const carried = published.published;
	const publishedSha256 = carried === undefined ? undefined : sha256({ content: carried.content });
	const moved = publishedSha256 !== expectedPublishedSha256 && publishedSha256 !== syncState?.recordSha256 && publishedSha256 !== attachedSha256;

	if (carried !== undefined && moved) {
		const surfaced = await withWorkOrderStateLock({
			workOrderFolder,
			run: () => surfaceWorkOrderDivergence({ workOrderFolder, name, ticketRef: target.ticketRef, content: carried.content }),
		});

		return { error: typeof surfaced === 'string' ? surfaced : surfaced.error };
	}

	const failure = await attachTicketRecord({ target, content, onProgress });

	return failure ?? { attachedSha256 };
};
