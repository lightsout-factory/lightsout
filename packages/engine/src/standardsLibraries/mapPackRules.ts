import type { LoadedStandardsRule } from '#src/common/types/LoadedStandardsRule.ts';
import type { ResolvedStandardsPack } from '#src/common/types/ResolvedStandardsPack.ts';

interface Params {
	packs: ResolvedStandardsPack[];
}

/** Each rule the packs bring in, keyed by full name, so a rule several packs hold appears once. */
export const mapPackRules = ({ packs }: Params): Map<string, LoadedStandardsRule> => {
	const rules = new Map<string, LoadedStandardsRule>();

	for (const { rule } of packs.flatMap((pack) => pack.rules)) {
		rules.set(rule.name, rule);
	}

	return rules;
};
