interface Params {
	rule: { deterministic: boolean; agent: boolean };
}

/**
 * The "check" cell of a rule table. A rule with both kinds of check is named
 * under both, or the table would read as though the deterministic check
 * decided all of it.
 */
export const describeCheckKinds = ({ rule }: Params): string => {
	if (rule.deterministic && rule.agent) {
		return 'deterministic and agent';
	}

	return rule.deterministic ? 'deterministic' : 'agent';
};
