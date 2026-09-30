import type { StandardsPackSource } from '#src/contracts/standards/StandardsPackSource.ts';
import type { ResolvedRuleState } from '#src/standardsCheck/common/types/ResolvedRuleState.ts';
import type { ResolvedStandardsPack } from '#src/standardsLibraries/common/types/ResolvedStandardsPack.ts';

/** One group of packages that share one pack. */
export interface StandardsGroup {
	/** Package folder names under packages-dir; '' is the repo root group (files outside the packages directory). Sorted, '' first. */
	packages: string[];
	pack: ResolvedStandardsPack;
	source: StandardsPackSource;
	/** Keyed by full rule name; one entry per rule in `pack.rules`. */
	states: Map<string, ResolvedRuleState>;
}
