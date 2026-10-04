import type { TrackerAttachment } from '#src/common/types/TrackerAttachment.ts';
import type { TrackerFailure } from '#src/common/types/TrackerFailure.ts';
import type { JiraTrackerSettings } from '#src/common/types/TrackerSettings.ts';
import { parseTicketNumber } from '#src/ticketTracker/common/parseTicketNumber.ts';
import { runJira } from '#src/ticketTracker/jira/common/runJira.ts';

interface Params {
	settings: JiraTrackerSettings;
	identifier: string;
}

export interface JiraAttachment {
	id: string;
	filename: string;
}

interface AttachmentsResponse {
	fields: { attachment?: JiraAttachment[] | null };
}

export const getTicketAttachments = async ({ settings, identifier }: Params): Promise<TrackerAttachment[] | TrackerFailure> => {
	const number = parseTicketNumber({ identifier, ticketPrefix: settings.ticketPrefix });

	if (number === undefined) {
		return { error: `'${identifier}' names no ticket number` };
	}

	const issueKey = `${settings.ticketPrefix}-${number}`;

	return runJira({
		settings,
		request: async (client) => {
			const issue = await client.request<AttachmentsResponse>({
				method: 'GET',
				path: `/rest/api/3/issue/${encodeURIComponent(issueKey)}?fields=attachment`,
				response: 'json',
			});

			return (issue.fields.attachment ?? []).map(({ id, filename }) => ({
				id,
				title: filename,
				url: new URL(`/rest/api/3/attachment/content/${encodeURIComponent(id)}`, settings.siteUrl).toString(),
			}));
		},
	});
};
