import type { TrackerAttachment } from '#src/ticketTracker/common/types/TrackerAttachment.ts';
import type { TrackerFailure } from '#src/ticketTracker/common/types/TrackerFailure.ts';
import type { LinearTrackerSettings } from '#src/ticketTracker/common/types/TrackerSettings.ts';
import { parseTicketNumber } from '#src/ticketTracker/internal/common/utils/parseTicketNumber.ts';
import { collectNodes } from '#src/ticketTracker/linear/internal/common/utils/collectNodes.ts';
import { runLinear } from '#src/ticketTracker/linear/internal/runLinear.ts';

interface Params {
	settings: LinearTrackerSettings;
	/** e.g. 'lo-54' — matched case-insensitively by number. */
	identifier: string;
}

/** A missing ticket is a failure, not an empty list: a wrong team key and an empty ticket are different fixes. */
export const getTicketAttachments = async ({ settings, identifier }: Params): Promise<TrackerAttachment[] | TrackerFailure> => {
	const number = parseTicketNumber({ identifier, ticketPrefix: settings.ticketPrefix });

	if (number === undefined) {
		return { error: `'${identifier}' names no ticket number` };
	}

	const issueNumber = Number(number);

	return runLinear({
		apiKey: settings.apiKey,
		call: async (client) => {
			const connection = await client.issues({ filter: { team: { key: { eq: settings.team } }, number: { eq: issueNumber } } });
			const issue = (await collectNodes({ connection })).at(0);

			if (issue === undefined) {
				return { error: `no ticket '${identifier}' in team ${settings.team}` };
			}

			// A truncated list would restore a plan missing its later phases.
			const attachments = await collectNodes({ connection: await issue.attachments() });

			return attachments.map(({ id, title, url }) => ({ id, title, url }));
		},
	});
};
