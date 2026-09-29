import type { Connection, Issue } from '@linear/sdk';
import type { TrackerFailure } from '#src/ticketTracker/common/types/TrackerFailure.ts';
import type { TrackerTicket } from '#src/ticketTracker/common/types/TrackerTicket.ts';
import { collectNodes } from '#src/ticketTracker/linear/internal/common/utils/collectNodes.ts';
import { getUnfinishedBlockers } from '#src/ticketTracker/linear/internal/common/utils/getUnfinishedBlockers.ts';
import { isFinishedState } from '#src/ticketTracker/linear/internal/common/utils/isFinishedState.ts';
import { readLabelNames } from '#src/ticketTracker/linear/internal/common/utils/readLabelNames.ts';
import { toTrackerTicket } from '#src/ticketTracker/linear/internal/common/utils/toTrackerTicket.ts';

interface Params {
	/** The first page of issues, as the client answered it. */
	connection: Connection<Issue>;
}

const isFailure = (entry: TrackerTicket | TrackerFailure): entry is TrackerFailure => 'error' in entry;

/**
 * An unreadable workflow state fails the whole read: an empty status matches
 * nothing selectable, so it would silently drop the ticket from the backlog.
 */
export const collectTrackerTickets = async ({ connection }: Params): Promise<TrackerTicket[] | TrackerFailure> => {
	const issues = await collectNodes({ connection });
	const resolved = await Promise.all(
		issues.map(async (issue): Promise<TrackerTicket | TrackerFailure> => {
			const [labels, unfinishedBlockers, state] = await Promise.all([readLabelNames({ issue }), getUnfinishedBlockers({ issue }), issue.state]);

			return state === undefined
				? { error: `Linear issue '${issue.identifier}' has no readable workflow status` }
				: toTrackerTicket({ issue, labels, status: state.name, finished: isFinishedState({ stateType: state.type }), unfinishedBlockers });
		}),
	);
	const failure = resolved.find(isFailure);

	return failure ?? resolved.filter((entry): entry is TrackerTicket => !isFailure(entry));
};
