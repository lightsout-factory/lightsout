/** Lowercase because these are the literal strings the plan-writer agent emits in its JSON report. */
export const PlanDraftStatus = {
	Drafted: 'drafted',
	Error: 'error',
} as const;

export type PlanDraftStatus = (typeof PlanDraftStatus)[keyof typeof PlanDraftStatus];
