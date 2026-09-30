import type { LoadedStandardsLibrary } from '#src/standardsLibraries/common/types/LoadedStandardsLibrary.ts';
import type { ResolvedStandardsPack } from '#src/standardsLibraries/common/types/ResolvedStandardsPack.ts';
import { expandPack } from '#src/standardsLibraries/internal/expandPack.ts';

interface Params {
	/** `<library>/<file-stem>`. */
	address: string;
	/** Every library the repo registered, built-in first — as `resolveStandardsLibraries` returns them. */
	libraries: LoadedStandardsLibrary[];
}

/**
 * Grades each rule once, at the top: its rule.md default, then every included
 * pack's explicit value in include order, then the pack's own `rule-settings`,
 * with options merged key by key at every step. A rule graded `off` stays
 * listed, so a repo's own settings can still turn it on.
 *
 * @throws {Error} When the address, or any include or rule-settings entry reachable from it, cannot be resolved, or packs include each other in a cycle.
 */
export const resolveStandardsPack = ({ address, libraries }: Params): ResolvedStandardsPack => {
	const expansion = expandPack({ address, libraries, chain: [] });

	return {
		name: address,
		topics: [...expansion.topics.values()],
		rules: [...expansion.rules.values()].map((rule) => {
			const setting = expansion.settings.get(rule.name);

			return { rule, severity: setting?.severity ?? rule.defaultSeverity, options: { ...rule.defaultOptions, ...setting?.options } };
		}),
	};
};
