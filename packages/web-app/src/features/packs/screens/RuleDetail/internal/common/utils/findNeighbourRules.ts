import type { StandardsPackDocumentView, StandardsPackRuleListing } from '@lightsout/engine';
import { groupRulesByDocument } from '#src/features/packs/internal/common/utils/groupRulesByDocument.ts';

interface Params {
	documents: StandardsPackDocumentView[];
	rules: StandardsPackRuleListing[];
	ruleId: string;
}

export const findNeighbourRules = ({ documents, rules, ruleId }: Params): { previous?: StandardsPackRuleListing; next?: StandardsPackRuleListing } => {
	const channel = rules.find((rule) => rule.id === ruleId)?.channel;
	const ordered = groupRulesByDocument({
		documents: documents.filter((document) => document.channel === channel),
		rules: rules.filter((rule) => rule.channel === channel),
	}).flatMap((group) => group.rules);
	const index = ordered.findIndex((rule) => rule.id === ruleId);

	return index === -1 ? {} : { previous: ordered[index - 1], next: ordered[index + 1] };
};
