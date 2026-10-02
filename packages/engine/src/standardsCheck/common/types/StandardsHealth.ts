import type { StandardsHealthRule } from '#src/standardsCheck/common/types/StandardsHealthRule.ts';

export interface StandardsHealth {
	rules: StandardsHealthRule[];
	/** A rule with a check that an agent also reviews counts under both `checked` and `judgment`, so the two can add up to more than `rules`. */
	totals: { rules: number; checked: number; judgment: number };
}
