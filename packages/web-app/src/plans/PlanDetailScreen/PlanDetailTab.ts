export const PlanDetailTab = {
	Plan: 'plan',
	Decisions: 'decisions',
	Facts: 'facts',
	Grade: 'grade',
	Dedup: 'dedup',
	Notes: 'notes',
} as const;

export type PlanDetailTab = (typeof PlanDetailTab)[keyof typeof PlanDetailTab];
