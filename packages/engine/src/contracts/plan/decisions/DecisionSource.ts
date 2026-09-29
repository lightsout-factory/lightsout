/**
 * Capitalized on purpose, an exception to the lowercase enum convention, so the
 * JSON `source` field and the markdown Decision-Log `Source` column share one token.
 */
export const DecisionSource = {
	Brainstorm: 'Brainstorm',
	Elicitation: 'Elicitation',
	Grill: 'Grill',
	Dedup: 'Dedup',
	Converge: 'Converge',
} as const;

export type DecisionSource = (typeof DecisionSource)[keyof typeof DecisionSource];
