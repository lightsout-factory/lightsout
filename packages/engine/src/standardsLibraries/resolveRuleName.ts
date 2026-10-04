import type { LoadedStandardsRule } from '#src/common/types/LoadedStandardsRule.ts';

interface Params {
	/** A full `<library>/<rule-id>` name, or a short rule id. */
	name: string;
	/** The rules the name may refer to — the caller decides the scope. */
	rules: LoadedStandardsRule[];
}

/**
 * A name holding `/` is a full name and matches only a rule's full name; it is
 * never resolved through its short half, which is why a library name may not
 * hold a slash. A name without `/` is a short id, accepted only while one rule
 * in scope holds it.
 *
 * A problem is returned rather than thrown, so each caller decides what an
 * unresolved name costs: a config key stops the load, an agent's report drops
 * one finding.
 *
 * @returns The one rule the name spells, or a problem naming the name and, for an ambiguous short id, every full candidate.
 */
export const resolveRuleName = ({ name, rules }: Params): { rule: LoadedStandardsRule } | { problem: string } => {
	const isFullName = name.includes('/');
	const matches = rules.filter((rule) => (isFullName ? rule.name === name : rule.id === name));
	let resolved: { rule: LoadedStandardsRule } | { problem: string };

	if (matches.length === 1) {
		resolved = { rule: matches[0] };
	} else if (matches.length === 0) {
		resolved = { problem: `no rule is named "${name}"` };
	} else {
		const candidates = matches.map((rule) => rule.name).sort();

		resolved = { problem: `the short id "${name}" is held by several rules — write one of ${candidates.join(', ')}` };
	}

	return resolved;
};
