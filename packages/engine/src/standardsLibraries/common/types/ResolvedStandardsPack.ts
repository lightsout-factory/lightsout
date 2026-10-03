import type { LoadedStandardsRule } from '#src/standardsLibraries/common/types/LoadedStandardsRule.ts';
import type { LoadedStandardsTopic } from '#src/standardsLibraries/common/types/LoadedStandardsTopic.ts';
import type { ResolvedPackRule } from '#src/standardsLibraries/common/types/ResolvedPackRule.ts';

/** One pack, or several merged in listed order, expanded into everything their include lists bring in. */
export interface ResolvedStandardsPack {
	/** The pack's address, `<library>/<file-stem>`; several addresses are joined with ` + `, in listed order. */
	name: string;
	/** Each topic once, in first-appearance order. */
	topics: LoadedStandardsTopic[];
	/** Each rule once, by full name, in first-appearance order. */
	rules: ResolvedPackRule[];
	/** Addresses of the conditional packs that applied, in first-appearance order; empty when none did. */
	conditionalPacks: string[];
	/** Rules only a conditional pack that did not apply would have brought: a setting may name one, and it then does nothing. */
	inactiveRules: LoadedStandardsRule[];
}
