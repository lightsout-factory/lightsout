import { PlanningStatus } from '#src/common/constants/PlanningStatus.ts';
import { QueueWorker } from '#src/common/constants/QueueWorker.ts';

interface Params {
	planningStatus: PlanningStatus;
	/**
	 * The ticket's own workflow status, or undefined when the caller has already
	 * established this ticket is the queue's work — the parked scan, whose
	 * worktree on disk is that evidence.
	 */
	trackerStatus: string | undefined;
	/** The configured name of the ready-to-implement status. */
	readyStatus: string;
}

/**
 * The two shaping states are never automated, and `planning-not-needed` in
 * Backlog is neither selected nor moved.
 *
 * A mid-run relabel lands correctly: a queued auto-plan ticket becomes
 * `planning-complete` once its plan is published, so a park during its nested
 * implementation resumes as the plan worker, the same work it was doing.
 */
export const selectQueueWorker = ({ planningStatus, trackerStatus, readyStatus }: Params): QueueWorker | undefined => {
	// An undefined status satisfies both halves, which is what lets the parked scan
	// resume a ticket whose worktree already answered the status question.
	const atReady = trackerStatus === undefined || trackerStatus === readyStatus;
	// The ticket came from the eligible query, so any status but the ready one is Backlog.
	const inBacklog = trackerStatus !== readyStatus;
	const selected: Record<PlanningStatus, QueueWorker | undefined> = {
		[PlanningStatus.NeedsBrainstorm]: undefined,
		[PlanningStatus.NeedsPlan]: undefined,
		[PlanningStatus.ReadyAutoPlan]: inBacklog ? QueueWorker.AutoPlan : undefined,
		[PlanningStatus.Complete]: atReady ? QueueWorker.Plan : undefined,
		[PlanningStatus.NotNeeded]: atReady ? QueueWorker.Direct : undefined,
	};

	return selected[planningStatus];
};
