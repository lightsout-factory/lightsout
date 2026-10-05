import type { LoadedStandardsRule } from '#src/common/types/LoadedStandardsRule.ts';
import type { LoadedStandardsTopic } from '#src/common/types/LoadedStandardsTopic.ts';
import type { StandardsSeverity } from '#src/contracts/standardsCheck/StandardsSeverity.ts';

/** What one pack brings in, each topic and rule once, in first-appearance order. */
export interface PackExpansion {
	/** Keyed `<library>/<topic path>`. */
	topics: Map<string, LoadedStandardsTopic>;
	/** Keyed by full rule name. */
	rules: Map<string, LoadedStandardsRule>;
	/**
	 * Keyed by full rule name, holding only values a pack wrote — never a
	 * rule.md default, which must not override an earlier pack's explicit value.
	 */
	settings: Map<string, { severity?: StandardsSeverity; options: Record<string, number> }>;
	/** Addresses of the conditional packs that applied, in first-appearance order. */
	conditionalPacks: Set<string>;
	/** Keyed by full rule name: what conditional packs that did not apply would have brought. May repeat a rule in `rules`. */
	inactiveRules: Map<string, LoadedStandardsRule>;
}
