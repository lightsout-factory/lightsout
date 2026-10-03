import type { StandardsHealthRule } from '#src/standardsCheck/common/types/StandardsHealthRule.ts';

export interface StandardsHealth {
	rules: StandardsHealthRule[];
	/** A rule with both kinds of check counts under both `deterministic` and `agent`, so the two can add up to more than `rules`. */
	totals: { rules: number; deterministic: number; agent: number };
}
