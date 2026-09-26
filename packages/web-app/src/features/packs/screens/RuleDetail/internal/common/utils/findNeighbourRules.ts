import type { StandardsPackDocumentView, StandardsPackRuleListing } from '@lightsout/engine';
import { groupRulesByDocument } from '#src/features/packs/internal/common/utils/groupRulesByDocument.ts';

interface Params {
	documents: StandardsPackDocumentView[];
	rules: StandardsPackRuleListing[];
	/** The rule whose neighbours are wanted. */
	ruleId: string;
}

/**
 * The rules just before and just after one rule, in its set's reading order —
 * the order the set's page lists them in, document by document. Neither
 * crosses into another set, and either is absent at that end of the list.
 *
 * @param documents - the pack's documents, in pack order
 * @param rules - the pack's rules
 * @param ruleId - the rule to look either side of
 */
export const findNeighbourRules = ({ documents, rules, ruleId }: Params): { previous?: StandardsPackRuleListing; next?: StandardsPackRuleListing } => {
	const channel = rules.find((rule) => rule.id === ruleId)?.channel;
	const ordered = groupRulesByDocument({
		documents: documents.filter((document) => document.channel === channel),
		rules: rules.filter((rule) => rule.channel === channel),
	}).flatMap((group) => group.rules);
	const index = ordered.findIndex((rule) => rule.id === ruleId);

	return index === -1 ? {} : { previous: ordered[index - 1], next: ordered[index + 1] };
};
