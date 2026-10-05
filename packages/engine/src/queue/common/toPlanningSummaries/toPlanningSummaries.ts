import { PlanningStatus } from '#src/common/constants/PlanningStatus.ts';
import { TrackerStatusRole } from '#src/common/constants/TrackerStatusRole.ts';
import type { LifecycleSettings } from '#src/common/types/LifecycleSettings.ts';
import type { TicketSummary } from '#src/common/types/TicketSummary.ts';
import type { TrackerTicket } from '#src/common/types/TrackerTicket.ts';
import { selectQueueWorker } from '#src/queue/common/toPlanningSummaries/selectQueueWorker.ts';

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
