import { PlanningStatus } from '#src/common/constants/PlanningStatus.ts';
import type { TicketSummary } from '#src/queue/common/types/TicketSummary.ts';
import { selectQueueWorker } from '#src/queue/internal/common/utils/selectQueueWorker.ts';
import { TrackerStatusRole } from '#src/ticketLifecycle/common/constants/TrackerStatusRole.ts';
import type { LifecycleSettings } from '#src/ticketLifecycle/common/types/LifecycleSettings.ts';
import type { TrackerTicket } from '#src/ticketTracker/common/types/TrackerTicket.ts';

interface Params {
	ticket: TrackerTicket;
	lifecycle: LifecycleSettings;
	/**
	 * From the parked scan, whose worktree is already the evidence the queue
	 * selected it; its tracker status is In Progress and no longer answers the pair rule.
	 */
	resumed: boolean;
}

/**
 * A ticket with no planning-status label yields none, which the caller reads as
 * the automation withdrawn. One carrying two yields two, so the drain's ambiguity
 * skip sees it.
 */
export const toPlanningSummaries = ({ ticket, lifecycle, resumed }: Params): TicketSummary[] =>
	Object.values(PlanningStatus)
		.filter((planningStatus) => ticket.labels.includes(lifecycle.planningStatusLabels[planningStatus]))
		.map((planningStatus) => ({
			...ticket,
			planningStatus,
			worker: selectQueueWorker({
				planningStatus,
				trackerStatus: resumed ? undefined : ticket.status,
				readyStatus: lifecycle.statusNames[TrackerStatusRole.Ready],
			}),
		}));
