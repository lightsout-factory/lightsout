import type { StandardsPackRuleListing } from '@lightsout/engine';
import { toCheckKinds } from '#src/common/utils/toCheckKinds.ts';
import type { PackRuleFilters } from '#src/features/packs/screens/PackPage/internal/common/types/PackRuleFilters.ts';

interface Params {
	rules: StandardsPackRuleListing[];
	filters: PackRuleFilters;
}

/** The free-text filter is a plain substring, not a regular expression: a reader types "any" and means the rule about `any`. */
export const filterPackRules = ({ rules, filters }: Params): StandardsPackRuleListing[] => {
	const text = filters.text?.trim().toLowerCase() ?? '';

	return rules.filter(
		(rule) =>
			(filters.set === undefined || rule.set === filters.set) &&
			(filters.check === undefined || toCheckKinds({ deterministic: rule.deterministic, agent: rule.agent }).includes(filters.check)) &&
			(filters.severity === undefined || rule.defaultSeverity === filters.severity) &&
			(text === '' || rule.id.toLowerCase().includes(text) || rule.summary.toLowerCase().includes(text)),
	);
};
