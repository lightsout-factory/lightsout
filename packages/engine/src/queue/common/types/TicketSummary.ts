import type { PlanningStatus } from '#src/common/constants/PlanningStatus.ts';
import type { QueueWorker } from '#src/queue/common/constants/QueueWorker.ts';
import type { TrackerTicket } from '#src/ticketTracker/common/types/TrackerTicket.ts';

export interface TicketSummary extends TrackerTicket {
	planningStatus: PlanningStatus;
	/** Selected by the planning status and tracker status together; absent when the queue does not take that pair. */
	worker?: QueueWorker;
}
