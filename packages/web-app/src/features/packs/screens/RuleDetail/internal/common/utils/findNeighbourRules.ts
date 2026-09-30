import type { StandardsPackRuleListing, StandardsTopicView } from '@lightsout/engine';
import { groupRulesByTopic } from '#src/features/packs/internal/common/utils/groupRulesByTopic.ts';

interface Params {
	topics: StandardsTopicView[];
	rules: StandardsPackRuleListing[];
	ruleId: string;
}

/** Walks the whole library in reading order, so the last rule of one topic steps into the first rule of the next. */
export const findNeighbourRules = ({ topics, rules, ruleId }: Params): { previous?: StandardsPackRuleListing; next?: StandardsPackRuleListing } => {
	const ordered = groupRulesByTopic({ topics, rules }).flatMap((group) => group.rules);
	const index = ordered.findIndex((rule) => rule.id === ruleId);

	return index === -1 ? {} : { previous: ordered[index - 1], next: ordered[index + 1] };
};
