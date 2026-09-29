import type { TrackerSettings } from '#src/ticketTracker/common/types/TrackerSettings.ts';

export interface TicketTrackerTarget {
	settings: TrackerSettings;
	/** e.g. 'lo-140'. */
	ticketRef: string;
}
