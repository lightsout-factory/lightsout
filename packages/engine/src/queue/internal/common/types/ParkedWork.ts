import type { TicketSummary } from '#src/queue/common/types/TicketSummary.ts';
import type { WorkOrderRunOutcome } from '#src/queue/common/types/WorkOrderRunOutcome.ts';
import type { LeftBehindTicket } from '#src/queue/internal/common/types/LeftBehindTicket.ts';
import type { MergedParkedTree } from '#src/queue/internal/common/types/MergedParkedTree.ts';

export interface ParkedWork {
	/** Tickets whose worktree still has work in it — they re-enter the drain ahead of every new ticket. */
	resumed: TicketSummary[];
	/** Worktrees that skip the drain: committed and clean ones headed straight for the merge, and ones that could not be read at all. */
	outcomes: WorkOrderRunOutcome[];
	/** Worktrees nothing could be done with, and why — a stray tree, or a ticket whose planning status no longer delegates it. */
	leftBehind: LeftBehindTicket[];
	merged: MergedParkedTree[];
}
