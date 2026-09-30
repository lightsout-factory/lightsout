import type { StandardsGroup } from '#src/standards/common/types/StandardsGroup.ts';
import type { StandardsRuleListing } from '#src/standardsCheck/common/types/StandardsRuleListing.ts';

interface Params {
	groups: StandardsGroup[];
}

/**
 * Judgment-only rules are listed beside the machine-checked ones: a rule nobody
 * can find out about is a rule nobody follows. A rule several groups hold is
 * listed once, by full name.
 */
export const listStandardsRules = ({ groups }: Params): StandardsRuleListing[] => {
	const listings = new Map<string, StandardsRuleListing>();

	for (const group of groups) {
		for (const { rule } of group.pack.rules) {
			const state = group.states.get(rule.name);

			// Skips nothing in practice; it keeps a rule from ever being listed with
			// a state nobody resolved.
			if (state === undefined || listings.has(rule.name)) {
				continue;
			}

			listings.set(rule.name, {
				rule: rule.name,
				doc: `${rule.library}: ${rule.documentPath}`,
				summary: rule.summary,
				checked: rule.checked,
				severity: state.severity,
				fromConfig: state.fromConfig,
				options: state.options,
			});
		}
	}

	return [...listings.values()].sort((first, second) => first.rule.localeCompare(second.rule));
};
