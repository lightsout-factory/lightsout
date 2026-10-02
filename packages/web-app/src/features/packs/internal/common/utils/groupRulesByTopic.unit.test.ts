import { describe, expect, test } from '@jest/globals';
import type { StandardsPackRuleListing, StandardsTopicView } from '@lightsout/engine';
import { StandardsSet } from '@lightsout/engine/contracts';
import { groupRulesByTopic } from '#src/features/packs/internal/common/utils/groupRulesByTopic.ts';
import { buildStandardsPackRuleListing } from '#tests/helpers/buildStandardsPackRuleListing.ts';
import { buildStandardsPackView } from '#tests/helpers/buildStandardsPackView.ts';

const allRules = [
	buildStandardsPackRuleListing({ id: 'type-assertion', documentPath: 'code/agent-corrections/type-safety' }),
	buildStandardsPackRuleListing({ id: 'class-syntax', documentPath: 'code/code-style/classes' }),
	buildStandardsPackRuleListing({ id: 'object-args', documentPath: 'code/code-style/functions' }),
];

const setupGroupRulesByTopic = ({ rules = allRules }: { rules?: StandardsPackRuleListing[] } = {}) => {
	const pack = buildStandardsPackView({ rules: allRules });

	return { groups: groupRulesByTopic({ topics: pack.topics, rules }) };
};

const buildTopic = ({ path, ruleIds }: { path: string; ruleIds: string[] }): StandardsTopicView => ({
	set: StandardsSet.Code,
	path,
	intro: `# ${path}`,
	ruleIds,
});

const setupThreeTopics = () => {
	const topics = [
		buildTopic({ path: 'code/frameworks/react', ruleIds: ['react-a', 'react-b'] }),
		buildTopic({ path: 'code/frameworks/nestjs', ruleIds: ['nest-a'] }),
		buildTopic({ path: 'code/code-style/functions', ruleIds: ['fn-a', 'fn-b'] }),
	];
	const rules = [
		buildStandardsPackRuleListing({ id: 'fn-b', documentPath: 'code/code-style/functions' }),
		buildStandardsPackRuleListing({ id: 'react-b', documentPath: 'code/frameworks/react' }),
		buildStandardsPackRuleListing({ id: 'fn-a', documentPath: 'code/code-style/functions' }),
		buildStandardsPackRuleListing({ id: 'react-a', documentPath: 'code/frameworks/react' }),
	];

	return { topics, rules };
};

describe('groupRulesByTopic', () => {
	test('groups rules under the topics that name them and drops a topic left empty', () => {
		const { topics, rules } = setupThreeTopics();

		const groups = groupRulesByTopic({ topics, rules });

		expect(groups.map((group) => ({ path: group.topic.path, ruleIds: group.rules.map((rule) => rule.id) }))).toStrictEqual([
			{ path: 'code/frameworks/react', ruleIds: ['react-a', 'react-b'] },
			{ path: 'code/code-style/functions', ruleIds: ['fn-a', 'fn-b'] },
		]);
	});

	test('keeps the topics in the order the library assembles them, which is the reading order its author chose', () => {
		const { groups } = setupGroupRulesByTopic();

		expect(groups.map((group) => group.topic.path)).toStrictEqual([
			'code/agent-corrections/type-safety',
			'code/code-style/classes',
			'code/code-style/functions',
		]);
	});

	test("orders each topic's rules by its own list rather than by anything the caller passed", () => {
		const pack = buildStandardsPackView({
			rules: [buildStandardsPackRuleListing({ id: 'first' }), buildStandardsPackRuleListing({ id: 'second' })],
		});

		const groups = groupRulesByTopic({ topics: pack.topics, rules: [...pack.rules].reverse() });

		expect(groups[0].rules.map((rule) => rule.id)).toStrictEqual(['first', 'second']);
	});

	test('drops a topic whose rules were all filtered away, so a run of empty headings never appears', () => {
		const { groups } = setupGroupRulesByTopic({ rules: [allRules[2]] });

		expect(groups.map((group) => group.topic.path)).toStrictEqual(['code/code-style/functions']);
	});

	test('answers with nothing at all when no rule survived, which is the state the page owns an empty line for', () => {
		const { groups } = setupGroupRulesByTopic({ rules: [] });

		expect(groups).toStrictEqual([]);
	});

	test('drops a rule no topic claims rather than inventing a group to hold it', () => {
		const { groups } = setupGroupRulesByTopic({ rules: [...allRules, buildStandardsPackRuleListing({ id: 'orphan', documentPath: 'code/nowhere' })] });

		expect(groups.flatMap((group) => group.rules.map((rule) => rule.id))).toStrictEqual(['type-assertion', 'class-syntax', 'object-args']);
	});
});
