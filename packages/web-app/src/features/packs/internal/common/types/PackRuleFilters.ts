import type { StandardsSet, StandardsSeverity } from '@lightsout/engine/contracts';
import type { CheckKind } from '#src/common/constants/CheckKind.ts';

/**
 * An absent key means "do not narrow on this", which lets the whole object be
 * written straight into the URL: a filter cleared to `undefined` drops out of
 * the query string.
 */
export interface PackRuleFilters {
	set?: StandardsSet;
	channel?: string;
	check?: CheckKind;
	/** What the pack ships the rule at — `off` for a rule a repo opts into. */
	severity?: StandardsSeverity;
	text?: string;
}
