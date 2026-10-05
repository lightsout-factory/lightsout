import type { LoadedStandardsLibrary } from '#src/common/types/LoadedStandardsLibrary.ts';
import type { ResolvedStandardsPack } from '#src/common/types/ResolvedStandardsPack.ts';
import { expandPacks } from '#src/standardsLibraries/resolveStandardsPack/expandPacks/expandPacks.ts';

interface Params {
	/** Pack addresses, `<library>/<file-stem>`; several are merged in listed order, the last listed winning where two grade one rule. */
	addresses: string[];
	/** Every library the repo registered, built-in first — as `resolveStandardsLibraries` returns them. */
	libraries: LoadedStandardsLibrary[];
	/**
	 * The dependencies the package declares, which decide whether each
	 * conditional pack applies. Undefined = every conditional pack applies, which
	 * is what a pack page and library validation want: the whole pack.
	 */
	dependencies: ReadonlySet<string> | undefined;
}

/**
 * Grades each rule once, at the top: its rule.md default, then every included
 * pack's explicit value in include order, then the pack's own `rule-settings`,
 * with options merged key by key at every step. A rule graded `off` stays
 * listed, so a repo's own settings can still turn it on.
 *
 * @throws {Error} When an address, or any include or rule-settings entry reachable from one, cannot be resolved, or packs include each other in a cycle.
 */
export const resolveStandardsPack = ({ addresses, libraries, dependencies }: Params): ResolvedStandardsPack => {
	const expansion = expandPacks({ addresses, libraries, dependencies });

	return {
		name: addresses.join(' + '),
		topics: [...expansion.topics.values()],
		rules: [...expansion.rules.values()].map((rule) => {
			const setting = expansion.settings.get(rule.name);

			return { rule, severity: setting?.severity ?? rule.defaultSeverity, options: { ...rule.defaultOptions, ...setting?.options } };
		}),
		conditionalPacks: [...expansion.conditionalPacks],
		inactiveRules: [...expansion.inactiveRules.values()].filter((rule) => !expansion.rules.has(rule.name)),
	};
};
