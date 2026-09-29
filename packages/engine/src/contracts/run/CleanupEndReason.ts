/** None of these stops the run: cleanup is bounded best-effort tidying, and what it leaves goes on to normal verification. */
export const CleanupEndReason = {
	/** Nothing qualified as work on the first look, so no cleanup agent was ever spawned. */
	NoWork: 'no-work',
	Clean: 'clean',
	/** Two consecutive rounds left the identical qualifying work list unchanged — a stable disagreement, not something another round can settle. */
	DeclinedTwice: 'declined-twice',
	BudgetExhausted: 'budget-exhausted',
	/** The cleanup agent timed out, returned no usable report, or returned one whose status was not `complete`. */
	AgentFailed: 'agent-failed',
} as const;

export type CleanupEndReason = (typeof CleanupEndReason)[keyof typeof CleanupEndReason];
