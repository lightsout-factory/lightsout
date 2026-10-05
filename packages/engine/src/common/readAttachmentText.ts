import type { TrackerAttachment } from '#src/common/types/TrackerAttachment.ts';
import type { TrackerSettings } from '#src/common/types/TrackerSettings.ts';
import { readTicketAsset } from '#src/ticketTracker/readTicketAsset.ts';

interface Params {
	settings: TrackerSettings;
	attachment: TrackerAttachment;
}

/**
 * The result is annotated rather than inferred: without it the two branches
 * widen into one shape carrying an optional `error`, and `'error' in read`
 * stops narrowing at the call site.
 */
export const readAttachmentText = async ({ settings, attachment }: Params): Promise<{ text: string } | { error: string }> => {
	const text = await readTicketAsset({ settings, url: attachment.url });

	return typeof text === 'string' ? { text } : { error: `the ticket's ${attachment.title} could not be read: ${text.error}` };
};
