import { StandardsSet } from '@lightsout/standards-contracts';
import type { StandardsGroup } from '#src/standards/common/types/StandardsGroup.ts';
import type { LoadedStandardsTopic } from '#src/standardsLibraries/common/types/LoadedStandardsTopic.ts';

interface Params {
	groups: StandardsGroup[];
}

const compareText = ({ left, right }: { left: string; right: string }) => (left === right ? 0 : left > right ? 1 : -1);

const byLibraryThenPath = (left: LoadedStandardsTopic, right: LoadedStandardsTopic) =>
	compareText({ left: left.library, right: right.library }) || compareText({ left: left.path, right: right.path });

const renderTopic = ({ topic, proseByName }: { topic: LoadedStandardsTopic; proseByName: Map<string, string> }) => {
	// A topic lists its rules by short id, which is unique inside the topic's own library.
	const prose = topic.ruleIds.map((id) => proseByName.get(`${topic.library}/${id}`) ?? '');
	const parts = [topic.intro, ...prose].filter((part) => part.length > 0);

	return `<!-- ${topic.library}: ${topic.path} -->\n${parts.join('\n\n')}`;
};

const renderGroupSet = ({ group, set }: { group: StandardsGroup; set: StandardsSet }) => {
	const reaching = group.pack.rules.filter(({ rule }) => group.states.get(rule.name)?.reachesAgents === true);
	const proseByName = new Map(reaching.map(({ rule }) => [rule.name, rule.prose]));
	const topics = group.pack.topics.filter((topic) => topic.set === set).sort(byLibraryThenPath);

	return topics.map((topic) => renderTopic({ topic, proseByName })).join('\n\n');
};

/**
 * Assembled at load time from the rule folders themselves, so there is no
 * pre-built copy anywhere that can drift from the prose.
 *
 * A rule's prose goes to agents only while its state `reachesAgents`. A rule
 * the pack ships `off` is one a repo opts into, so its prose is left out until
 * the repo turns it on: an agent told to follow a convention the repo never
 * chose writes code the repo's own reviewers reject. A rule the repo turned off
 * itself keeps its prose — off there means its own linter enforces the rule,
 * and the standard still holds.
 */
export const buildStandardsDocuments = ({ groups }: Params): { code?: string; tests?: string } => {
	const renderSet = ({ set }: { set: StandardsSet }) => {
		const rendered = groups.map((group) => renderGroupSet({ group, set })).filter((text) => text.length > 0);

		return rendered.length === 0 ? undefined : rendered.join('\n\n');
	};

	const code = renderSet({ set: StandardsSet.Code });
	const tests = renderSet({ set: StandardsSet.Tests });
	const assembled: { code?: string; tests?: string } = {};

	if (code !== undefined) {
		assembled.code = code;
	}

	if (tests !== undefined) {
		assembled.tests = tests;
	}

	return assembled;
};
