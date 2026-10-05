import type { TicketSummary } from '#src/common/types/TicketSummary.ts';

/**
 * Carried rather than settled where it is found, because settling it mutates the
 * main checkout, which the queue does only under the run lock the parked scan
 * runs before.
 */
export interface MergedParkedTree {
	/** The queue's own spelling of the path, already re-rooted by the scan. */
	worktreePath: string;
	branch: string;
	ticket: TicketSummary;
}
