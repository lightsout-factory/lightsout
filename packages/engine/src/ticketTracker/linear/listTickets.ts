import type { TrackerFailure } from '#src/ticketTracker/common/types/TrackerFailure.ts';
import type { LinearTrackerSettings } from '#src/ticketTracker/common/types/TrackerSettings.ts';
import type { TrackerTicket } from '#src/ticketTracker/common/types/TrackerTicket.ts';
import { collectTrackerTickets } from '#src/ticketTracker/linear/internal/common/utils/collectTrackerTickets.ts';
import { runLinear } from '#src/ticketTracker/linear/internal/runLinear.ts';

interface Params {
	settings: LinearTrackerSettings;
	/** An issue carrying any one of them is returned once. */
	labelNames: string[];
	/** Workflow-state names a ticket may be in to be returned. */
	statuses: string[];
}

/**
 * One query for the whole label set, so a ticket carrying two labels comes back
 * once with both names and the caller decides what the second one means.
 *
 * Blockers cost extra round trips per issue, all inside one tracker deadline:
 * Linear's issue filter cannot express "has an unfinished blocker".
 */
export const listTickets = async ({ settings, labelNames, statuses }: Params): Promise<TrackerTicket[] | TrackerFailure> => {
	if (labelNames.length === 0 || statuses.length === 0) {
		return [];
	}

	return runLinear({
		apiKey: settings.apiKey,
		call: async (client) => {
			const connection = await client.issues({
				filter: {
					team: { key: { eq: settings.team } },
					labels: { name: { in: labelNames } },
					state: { name: { in: statuses } },
				},
			});

			return collectTrackerTickets({ connection });
		},
	});
};
