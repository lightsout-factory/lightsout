import type { Issue } from '@linear/sdk';
import type { TrackerTicket } from '#src/ticketTracker/common/types/TrackerTicket.ts';

interface Params {
	issue: Issue;
	labels: string[];
	status: string;
	finished: boolean;
	unfinishedBlockers: string[];
}

/** So no Linear type leaves the folder. */
export const toTrackerTicket = ({ issue, labels, status, finished, unfinishedBlockers }: Params): TrackerTicket => ({
	id: issue.id,
	identifier: issue.identifier,
	title: issue.title,
	url: issue.url,
	description: issue.description ?? '',
	priority: issue.priority,
	createdAt: issue.createdAt.toISOString(),
	labels,
	status,
	finished,
	unfinishedBlockers,
});
