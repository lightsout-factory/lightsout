/** Lowercase because these are the literal strings the plan-repairer agent emits in its JSON report. */
export const PlanFixStatus = {
	Fixed: 'fixed',
	Error: 'error',
} as const;

export type PlanFixStatus = (typeof PlanFixStatus)[keyof typeof PlanFixStatus];
