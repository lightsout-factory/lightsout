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
	/** Globs from every pack that set them for this rule, unioned in first-appearance order. Each matches a file's path relative to its own workspace package root, or the repo root for a file outside every package. */
	exclude: string[];
}
