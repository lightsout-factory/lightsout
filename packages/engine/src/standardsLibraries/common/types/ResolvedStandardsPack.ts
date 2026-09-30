import type { LoadedStandardsTopic } from '#src/standardsLibraries/common/types/LoadedStandardsTopic.ts';
import type { ResolvedPackRule } from '#src/standardsLibraries/common/types/ResolvedPackRule.ts';

/** A pack expanded into everything its include lists bring in. */
export interface ResolvedStandardsPack {
	/** The pack's address, `<library>/<file-stem>`. */
	name: string;
	/** Each topic once, in first-appearance order. */
	topics: LoadedStandardsTopic[];
	/** Each rule once, by full name, in first-appearance order. */
	rules: ResolvedPackRule[];
}
