import type { TrackerFailure } from '#src/common/types/TrackerFailure.ts';
import type { LinearTrackerSettings } from '#src/common/types/TrackerSettings.ts';
import type { TrackerTicket } from '#src/common/types/TrackerTicket.ts';
import { parseTicketNumber } from '#src/ticketTracker/common/parseTicketNumber.ts';
import { collectTrackerTickets } from '#src/ticketTracker/linear/common/collectTrackerTickets/collectTrackerTickets.ts';
import { runLinear } from '#src/ticketTracker/linear/common/runLinear.ts';

interface Params {
	settings: LinearTrackerSettings;
	/** Human references, e.g. ['LO-70', 'LO-71'] — matched case-insensitively. */
	identifiers: string[];
}

const readIssueNumbers = ({ identifiers, ticketPrefix }: { identifiers: string[]; ticketPrefix: string }) =>
	identifiers.flatMap((identifier) => {
		const number = parseTicketNumber({ identifier, ticketPrefix });

		return number === undefined ? [] : [Number(number)];
	});

/**
 * No status filter: a ticket parked mid-drain sits at the in-progress status,
 * which a status-filtered list hides.
 */
export const getTicketsByIdentifiers = async ({ settings, identifiers }: Params): Promise<TrackerTicket[] | TrackerFailure> => {
	const issueNumbers = readIssueNumbers({ identifiers, ticketPrefix: settings.ticketPrefix });

	if (issueNumbers.length === 0) {
		return [];
	}

	return runLinear({
		apiKey: settings.apiKey,
		call: async (client) => {
			const connection = await client.issues({ filter: { team: { key: { eq: settings.team } }, number: { in: issueNumbers } } });

			return collectTrackerTickets({ connection });
		},
	});
};
