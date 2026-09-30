import { basename, dirname } from 'node:path';
import type { LoadedStandardsRule } from '#src/standardsLibraries/common/types/LoadedStandardsRule.ts';
import { libraryOfRequirement } from '#src/standardsLibraries/common/utils/libraryOfRequirement.ts';
import { resolveRuleName } from '#src/standardsLibraries/resolveRuleName.ts';

interface Params {
	/** The library's manifest name, which prefixes its rules' full names. */
	library: string;
	/** Every rule the walk loaded, with requires entries as rule.md wrote them. */
	rules: LoadedStandardsRule[];
}

/**
 * Resolves each rule's entries that name its own library to full names. An
 * entry naming another library is kept as written: that library may not be
 * loaded yet, so `findUnresolvedRequirements` checks it once every library is.
 *
 * Two rules requiring each other is allowed — it only means both must reach
 * agents — so nothing here looks for a cycle.
 *
 * @returns The rules with own-library entries rewritten, and one problem per entry that matches no rule, for the loader to throw with the rest.
 */
export const resolveRuleRequirements = ({ library, rules }: Params): { rules: LoadedStandardsRule[]; problems: string[] } => {
	const problems: string[] = [];
	const resolvedRules = rules.map((rule) => {
		const rulePath = `${rule.documentPath}/${basename(dirname(rule.fixturesPath))}`;
		const requires = rule.requires.map((entry) => {
			let name = entry;

			if (libraryOfRequirement({ entry, library }) === library) {
				const resolved = resolveRuleName({ name: entry, rules });

				if ('rule' in resolved) {
					name = resolved.rule.name;
				} else {
					problems.push(`${rulePath}: requires "${entry}" — ${resolved.problem}`);
				}
			}

			return name;
		});

		return { ...rule, requires };
	});

	return { rules: resolvedRules, problems };
};
