import type { ResolvedRuleState } from '#src/common/types/ResolvedRuleState.ts';
import type { ResolvedStandardsPack } from '#src/common/types/ResolvedStandardsPack.ts';

/** One group of packages whose standards resolve to the same packs. */
export interface StandardsGroup {
	/** Package folder names under packages-dir; '' is the repo root group (files outside the packages directory). Sorted, '' first. */
	packages: string[];
	pack: ResolvedStandardsPack;
	/** Keyed by full rule name; one entry per rule in `pack.rules`. */
	states: Map<string, ResolvedRuleState>;
}
