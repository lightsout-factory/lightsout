/**
 * One object for the family rather than one per command, because a caller that
 * handles `Failed` for draft handles it identically for grade.
 */
export const PlanRunStatus = {
	Complete: 'complete',
	Failed: 'failed',
	/** Hit the harness rate-limit wall — resumable, not an error. */
	PausedRateLimit: 'paused-rate-limit',
	/** Draft only: the plan's claims did not survive verification. */
	FactsError: 'facts-error',
	/** Draft only: the plan is structurally unsound and needs repair. */
	StructuralIssues: 'structural-issues',
} as const;

export type PlanRunStatus = (typeof PlanRunStatus)[keyof typeof PlanRunStatus];
