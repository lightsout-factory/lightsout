import type { QueueWorker } from '#src/common/constants/QueueWorker.ts';
import type { TicketSummary } from '#src/common/types/TicketSummary.ts';

// `worker` is required so no step downstream defaults an absent one to the
// direct worker for a ticket nothing selected.
export interface RunnableTicket extends TicketSummary {
	worker: QueueWorker;
}
