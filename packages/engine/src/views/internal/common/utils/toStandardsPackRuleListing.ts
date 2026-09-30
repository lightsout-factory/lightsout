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
	set: rule.set,
	documentPath: rule.documentPath,
	summary: rule.summary,
	channel: rule.channel,
	checked: rule.checked,
	defaultSeverity: rule.defaultSeverity,
	defaultOptions: rule.defaultOptions,
	fixtureCounts,
});
