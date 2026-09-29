export const PromptImprovementStatus = {
	/** Nothing was recorded this run, so no agent was spent. */
	NoFriction: 'no-friction',
	/** Friction was recorded and the improver was asked to read it. */
	Invoked: 'invoked',
} as const;

export type PromptImprovementStatus = (typeof PromptImprovementStatus)[keyof typeof PromptImprovementStatus];
