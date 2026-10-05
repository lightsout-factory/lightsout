import { messageOf } from '#src/common/messageOf.ts';
import type { TrackerFailure } from '#src/common/types/TrackerFailure.ts';
import type { LinearTrackerSettings } from '#src/common/types/TrackerSettings.ts';
import { collectNodes } from '#src/ticketTracker/linear/common/collectNodes.ts';
import { runLinear } from '#src/ticketTracker/linear/common/runLinear.ts';

interface Params {
	settings: LinearTrackerSettings;
	/** `TrackerTicket.id`. */
	ticketId: string;
	/** Both the attachment's title and the uploaded file's name, e.g. 'plan.md'. */
	title: string;
	content: Buffer;
	/** The upload's content type, e.g. 'text/markdown'. */
	contentType: string;
}

/**
 * Replaces any attachment with the same title, so a fetch never has to choose
 * between two copies. The read and both writes share one call and one deadline.
 */
export const setTicketAttachment = async ({ settings, ticketId, title, content, contentType }: Params): Promise<TrackerFailure | undefined> => {
	return runLinear({
		apiKey: settings.apiKey,
		call: async (client) => {
			const issue = await client.issue(ticketId);
			// Paged: a same-titled attachment on a later page would survive as a duplicate.
			const attachments = await collectNodes({ connection: await issue.attachments() });

			const payload = await client.fileUpload(contentType, title, content.byteLength);
			const uploadFile = payload.uploadFile;

			if (uploadFile === undefined || uploadFile === null) {
				return { error: `the tracker did not prepare an upload for '${title}'` };
			}

			const headers = Object.fromEntries(uploadFile.headers.map(({ key, value }): [string, string] => [key, value]));
			// A Node Buffer may sit on a non-plain ArrayBuffer, which `fetch` rejects.
			const body = new Uint8Array(content);
			const response = await fetch(uploadFile.uploadUrl, {
				method: 'PUT',
				headers: { ...headers, 'Cache-Control': 'public, max-age=31536000', 'Content-Type': contentType },
				body,
			});

			if (!response.ok) {
				return { error: `uploading '${title}' failed: ${response.status} ${response.statusText}` };
			}

			const created = await client.createAttachment({ issueId: ticketId, title, url: uploadFile.assetUrl });

			if (!created.success) {
				return { error: `the tracker uploaded '${title}' but did not link it to the ticket` };
			}

			for (const attachment of attachments.filter((candidate) => candidate.title === title)) {
				let deleted: Awaited<ReturnType<typeof client.deleteAttachment>>;

				try {
					deleted = await client.deleteAttachment(attachment.id);
				} catch (error) {
					return {
						error: `the tracker linked the new '${title}' but could not delete old attachment '${attachment.id}': ${messageOf({ error })}; duplicate copies remain`,
					};
				}

				if (!deleted.success) {
					return { error: `the tracker linked the new '${title}' but could not delete old attachment '${attachment.id}'; duplicate copies remain` };
				}
			}

			return undefined;
		},
	});
};
