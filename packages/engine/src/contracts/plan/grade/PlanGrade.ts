export const PlanGrade = {
	A: 'A',
	BelowA: 'below-A',
} as const;

export type PlanGrade = (typeof PlanGrade)[keyof typeof PlanGrade];
