/**
 * The `checks` line of a rule's front matter: which of the two kinds of check
 * the rule has. A deterministic check is code that decides, with the same
 * answer every run; an agent check is an agent reading the change against the
 * rule. A rule has one or both.
 */
export const StandardsRuleChecks = {
	/** The rule ships a check file, and the check decides the whole rule. */
	Deterministic: 'deterministic',
	/** The rule ships no check file; an agent reads the whole rule. */
	Agent: 'agent',
	/** The rule ships a check file that decides part of the rule; an agent reads the rest. */
	Both: 'both',
} as const;

export type StandardsRuleChecks = (typeof StandardsRuleChecks)[keyof typeof StandardsRuleChecks];
