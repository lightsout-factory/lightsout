import type { StandardsPackRuleListing } from '#src/contracts/views/StandardsPackRuleListing.ts';

interface Params {
	rule: Omit<StandardsPackRuleListing, 'fixtureCounts'>;
	fixtureCounts: StandardsPackRuleListing['fixtureCounts'];
}

/**
 * The counts arrive separately because only the fold has them to hand; the
 * projection copies the counts the fold already recorded.
 */
export const toStandardsPackRuleListing = ({ rule, fixtureCounts }: Params): StandardsPackRuleListing => ({
	id: rule.id,
	name: rule.name,
	set: rule.set,
	documentPath: rule.documentPath,
	summary: rule.summary,
	deterministic: rule.deterministic,
	agent: rule.agent,
	defaultSeverity: rule.defaultSeverity,
	defaultOptions: rule.defaultOptions,
	fixtureCounts,
});
