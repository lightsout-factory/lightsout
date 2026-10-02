interface Params {
	rule: { checked: boolean; reviewed: boolean };
}

/**
 * The "checked by" cell of a rule table. A rule whose check covers only part of
 * it is named under both, or the table would read as though code enforced all
 * of it.
 */
export const describeCheckedBy = ({ rule }: Params): string => {
	if (rule.checked && rule.reviewed) {
		return 'code and judgment';
	}

	return rule.checked ? 'code' : 'judgment';
};
