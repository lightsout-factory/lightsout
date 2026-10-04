import type { StandardsGroup } from '#src/common/types/StandardsGroup.ts';
import { canonicalJson } from '#src/common/utils/canonicalJson.ts';
import type { StandardsRuleListing } from '#src/standardsCheck/common/types/StandardsRuleListing.ts';

interface Params {
	groups: StandardsGroup[];
}

/** '' (the repo root group) first, then package names in order. */
const byRootThenName = (first: string, second: string) => Number(second === '') - Number(first === '') || first.localeCompare(second);

/**
 * Agent-only rules are listed beside the deterministic ones: a rule nobody
 * can find out about is a rule nobody follows. A rule is listed once for each
 * distinct state the groups resolve it to, naming the packages that state
 * applies to, so a rule graded alike everywhere is one row.
 */
export const listStandardsRules = ({ groups }: Params): StandardsRuleListing[] => {
	const listings = new Map<string, StandardsRuleListing>();

	for (const group of groups) {
		for (const { rule } of group.pack.rules) {
			const state = group.states.get(rule.name);

			// Skips nothing in practice; it keeps a rule from ever being listed with
			// a state nobody resolved.
			if (state === undefined) {
				continue;
			}

			// One row per rule and resolved state: severity, options compared by value, and whether the repo's config set it.
			const key = canonicalJson({ value: [rule.name, state.severity, state.options, state.fromConfig] });
			const listing = listings.get(key) ?? {
				rule: rule.name,
				doc: `${rule.library}: ${rule.documentPath}`,
				summary: rule.summary,
				deterministic: rule.deterministic,
				agent: rule.agent,
				severity: state.severity,
				fromConfig: state.fromConfig,
				options: state.options,
				packages: [],
			};

			listing.packages = [...new Set([...listing.packages, ...group.packages])].sort(byRootThenName);
			listings.set(key, listing);
		}
	}

	return [...listings.values()].sort((first, second) => first.rule.localeCompare(second.rule) || second.packages.length - first.packages.length);
};
