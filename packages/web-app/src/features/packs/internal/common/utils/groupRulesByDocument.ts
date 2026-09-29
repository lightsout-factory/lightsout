import type { StandardsPackDocumentView, StandardsPackRuleListing } from '@lightsout/engine';

interface Params {
	documents: StandardsPackDocumentView[];
	rules: StandardsPackRuleListing[];
}

/**
 * Rules keep the order their document's `ruleIds` names, the reading order the
 * pack author chose. A document left with no rules is dropped: given a filtered
 * list, a run of empty headings explains nothing.
 */
export const groupRulesByDocument = ({ documents, rules }: Params): Array<{ document: StandardsPackDocumentView; rules: StandardsPackRuleListing[] }> => {
	const byId = new Map(rules.map((rule) => [rule.id, rule]));

	return documents
		.map((document) => ({
			document,
			rules: document.ruleIds.flatMap((id) => {
				const rule = byId.get(id);

				return rule === undefined ? [] : [rule];
			}),
		}))
		.filter((group) => group.rules.length > 0);
};
