import type { LeftBehindTicket } from '#src/queue/internal/common/types/LeftBehindTicket.ts';
import type { RunnableTicket } from '#src/queue/internal/common/types/RunnableTicket.ts';

export interface WaveSelection {
	/** Tickets this wave will work, in the order they will be picked up. */
	runnable: RunnableTicket[];
	/** Tickets held back until every blocker finishes — re-offered by the next scan. */
	blocked: LeftBehindTicket[];
	/** Tickets settled for good, e.g. the ambiguous-planning-status skip. Never re-offered. */
	skipped: LeftBehindTicket[];
}
