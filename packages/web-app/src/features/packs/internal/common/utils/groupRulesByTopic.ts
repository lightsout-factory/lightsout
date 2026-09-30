import type { StandardsPackRuleListing, StandardsTopicView } from '@lightsout/engine';

interface Params {
	topics: StandardsTopicView[];
	rules: StandardsPackRuleListing[];
}

/**
 * Rules keep the order their topic's `ruleIds` names, the reading order the
 * library author chose. A topic left with no rules is dropped: given a filtered
 * list, a run of empty headings explains nothing.
 */
export const groupRulesByTopic = ({ topics, rules }: Params): Array<{ topic: StandardsTopicView; rules: StandardsPackRuleListing[] }> => {
	const byId = new Map(rules.map((rule) => [rule.id, rule]));

	return topics
		.map((topic) => ({
			topic,
			rules: topic.ruleIds.flatMap((id) => {
				const rule = byId.get(id);

				return rule === undefined ? [] : [rule];
			}),
		}))
		.filter((group) => group.rules.length > 0);
};
