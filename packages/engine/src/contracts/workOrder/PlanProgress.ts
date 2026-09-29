/**
 * A paused run leaves the plan `Implementing`. An exclusion is recorded beside
 * the progress rather than as a value, so an excluded plan keeps how far its
 * implementation got.
 */
export const PlanProgress = {
	Planning: 'planning',
	Ready: 'ready',
	Implementing: 'implementing',
	Implemented: 'implemented',
	Failed: 'failed',
} as const;

export type PlanProgress = (typeof PlanProgress)[keyof typeof PlanProgress];
