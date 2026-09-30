import { describe, expect, test } from '@jest/globals';
import type { StandardsTopicView } from '@lightsout/engine';
import { StandardsSet } from '@lightsout/engine/contracts';
import { findNeighbourRules } from '#src/features/packs/screens/RuleDetail/internal/common/utils/findNeighbourRules.ts';
import { buildStandardsPackRuleListing } from '#tests/helpers/buildStandardsPackRuleListing.ts';
import { buildStandardsPackView } from '#tests/helpers/buildStandardsPackView.ts';

const libraryRules = [
	buildStandardsPackRuleListing({ id: 'type-assertion', documentPath: 'code/typescript' }),
	buildStandardsPackRuleListing({ id: 'no-any', documentPath: 'code/typescript' }),
	buildStandardsPackRuleListing({ id: 'object-args', documentPath: 'code/functions' }),
	buildStandardsPackRuleListing({ id: 'react-size', documentPath: 'code/react' }),
];

const setupFindNeighbourRules = ({ ruleId, rules = libraryRules }: { ruleId: string; rules?: typeof libraryRules }) => {
	const pack = buildStandardsPackView({ rules });
	const neighbours = findNeighbourRules({ topics: pack.topics, rules: pack.rules, ruleId });

	return { ids: { previous: neighbours.previous?.id, next: neighbours.next?.id } };
};

const setupTopicSteps = () => {
	const topics: StandardsTopicView[] = [
		{ set: StandardsSet.Code, path: 'code/style-guide/patterns/functions', intro: '# Functions', ruleIds: ['object-args', 'function-size'] },
		{ set: StandardsSet.Code, path: 'code/architecture/react', intro: '# React', ruleIds: ['component-size', 'hook-naming'] },
	];
	const rules = [
		buildStandardsPackRuleListing({ id: 'object-args', documentPath: 'code/style-guide/patterns/functions' }),
		buildStandardsPackRuleListing({ id: 'function-size', documentPath: 'code/style-guide/patterns/functions' }),
		buildStandardsPackRuleListing({ id: 'component-size', documentPath: 'code/architecture/react' }),
		buildStandardsPackRuleListing({ id: 'hook-naming', documentPath: 'code/architecture/react' }),
	];

	return { topics, rules };
};

describe('findNeighbourRules', () => {
	test('walks across documents in the order the set lists them', () => {
		const { ids } = setupFindNeighbourRules({ ruleId: 'no-any' });

		expect(ids).toStrictEqual({ previous: 'type-assertion', next: 'object-args' });
	});

	test('stops at the end of the library rather than wrapping around to its start', () => {
		const { ids } = setupFindNeighbourRules({ ruleId: 'react-size' });

		expect(ids).toStrictEqual({ previous: 'object-args', next: undefined });
	});

	test('finds no neighbours for a rule alone in its library', () => {
		const { ids } = setupFindNeighbourRules({ ruleId: 'react-size', rules: [buildStandardsPackRuleListing({ id: 'react-size', documentPath: 'code/react' })] });

		expect(ids).toStrictEqual({ previous: undefined, next: undefined });
	});

	test('finds no neighbours for a rule the pack does not hold', () => {
		const { ids } = setupFindNeighbourRules({ ruleId: 'missing' });

		expect(ids).toStrictEqual({ previous: undefined, next: undefined });
	});

	test("steps from one topic's last rule into the next topic's first rule", () => {
		const { topics, rules } = setupTopicSteps();

		const [fromLastOfA, fromFirstOfB] = ['function-size', 'component-size'].map((ruleId) => findNeighbourRules({ topics, rules, ruleId }));

		expect({ nextAfterA: fromLastOfA?.next?.id, previousBeforeB: fromFirstOfB?.previous?.id }).toStrictEqual({
			nextAfterA: 'component-size',
			previousBeforeB: 'function-size',
		});
	});
});
