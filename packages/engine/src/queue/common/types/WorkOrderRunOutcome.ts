import type { TicketSummary } from '#src/queue/common/types/TicketSummary.ts';

/**
 * Three cases: `ready`, `open`, and anything else is a park, which only
 * `isParkedOutcome` decides.
 *
 * `ready` is not the branch's recorded phase: a ship-step park flips `ready`
 * while the branch stays recorded ready, so the next run re-ships it rather than
 * rebuilding finished work.
 */
export interface WorkOrderRunOutcome {
	ticket: TicketSummary;
	/** The work order's label — its folder under the work-orders directory, carried so no reader re-derives one from the branch. */
	name: string;
	/** The branch the worker committed to, as the work order's record stores it. */
	branch: string;
	/** Absolute path of the worktree. Removed after a successful ship, kept otherwise. */
	worktreePath: string;
	/** The wave-local "merge this branch in this wave" decision, set from the branch's recorded phase and never re-inferred here. */
	ready: boolean;
	/** Why it stopped. Absent when ready, and absent when the ticket was left open. */
	error?: string;
	/**
	 * Why a multiple-plan work order was left open: its record does not authorize
	 * shipping it yet. Set only with `ready` false and no `error`. It waits on a
	 * human rather than a re-run, so it is not a park.
	 */
	open?: string;
	/** True when the stop was a question nobody answered — the drain retires that ticket's slot instead of refilling it. */
	unanswered?: boolean;
	/**
	 * Separate from `error` and never paired with a flipped `ready`: a tracker
	 * failure cannot undo a confirmed merge, and parking it would send the next
	 * drain to re-ship a merged branch.
	 */
	reconciliationFailure?: string;
}
