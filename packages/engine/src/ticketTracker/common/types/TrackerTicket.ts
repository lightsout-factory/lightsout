/**
 * The seam reports what the tracker said and nothing more. There is no `route`
 * field: routing is the queue's vocabulary, so the queue reads the labels.
 * `status` and `finished` are the tracker's own words, so they belong here.
 */
export interface TrackerTicket {
	/** The tracker's internal id — what every write call takes. */
	id: string;
	/** The human reference, e.g. 'LO-70'. */
	identifier: string;
	title: string;
	url: string;
	/** Markdown; empty string when the ticket has none. */
	description: string;
	/** Smaller positive numbers sort first; zero means unspecified. */
	priority: number;
	/** ISO timestamp — the tiebreak within a priority. */
	createdAt: string;
	labels: string[];
	/** Exactly as the tracker spells it — 'Backlog', 'Ready to implement', 'In Progress', 'Done'. */
	status: string;
	/** Completed or canceled, as the tracker itself classifies the status. */
	finished: boolean;
	unfinishedBlockers: string[];
}
