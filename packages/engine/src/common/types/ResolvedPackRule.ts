import type { LoadedStandardsRule } from '#src/common/types/LoadedStandardsRule.ts';
import type { StandardsSeverity } from '#src/contracts/standardsCheck/StandardsSeverity.ts';

/**
 * One rule as a resolved pack grades it, before any repo setting. A rule the
 * pack sets `off`, or whose rule.md default is `off`, stays listed, so a
 * repo's `standards-rule-settings` can still turn it on.
 */
export interface ResolvedPackRule {
	rule: LoadedStandardsRule;
	/** `off` is the publisher's off: the rule does not run and does not reach agents unless the repo turns it on. */
	severity: StandardsSeverity;
	/** The rule's default options with every explicit layer merged over them key by key. */
	options: Record<string, number>;
}
