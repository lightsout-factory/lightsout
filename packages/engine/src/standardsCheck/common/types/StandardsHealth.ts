import type { StandardsHealthRule } from '#src/standardsCheck/common/types/StandardsHealthRule.ts';

export interface StandardsHealth {
	rules: StandardsHealthRule[];
	totals: { rules: number; checked: number; judgment: number };
}
