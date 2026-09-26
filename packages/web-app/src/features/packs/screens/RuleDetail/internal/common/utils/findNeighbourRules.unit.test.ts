import { describe, expect, test } from '@jest/globals';
import { findNeighbourRules } from '#src/features/packs/screens/RuleDetail/internal/common/utils/findNeighbourRules.ts';
import { buildStandardsPackRuleListing } from '#tests/helpers/buildStandardsPackRuleListing.ts';
import { buildStandardsPackView } from '#tests/helpers/buildStandardsPackView.ts';

const setupFindNeighbourRules = ({ ruleId }: { ruleId: string }) => {
	const pack = buildStandardsPackView({
		rules: [
			buildStandardsPackRuleListing({ id: 'type-assertion', documentPath: 'code/typescript' }),
			buildStandardsPackRuleListing({ id: 'no-any', documentPath: 'code/typescript' }),
			buildStandardsPackRuleListing({ id: 'object-args', documentPath: 'code/functions' }),
			buildStandardsPackRuleListing({ id: 'react-size', documentPath: 'code/react', channel: 'react' }),
		],
	});
	const neighbours = findNeighbourRules({ documents: pack.documents, rules: pack.rules, ruleId });

	return { ids: { previous: neighbours.previous?.id, next: neighbours.next?.id } };
};

describe('findNeighbourRules', () => {
	test('walks across documents in the order the set lists them', () => {
		const { ids } = setupFindNeighbourRules({ ruleId: 'no-any' });

		expect(ids).toStrictEqual({ previous: 'type-assertion', next: 'object-args' });
	});

	test('stops at the end of a set rather than crossing into the next one', () => {
		const { ids } = setupFindNeighbourRules({ ruleId: 'object-args' });

		expect(ids).toStrictEqual({ previous: 'no-any', next: undefined });
	});

	test('finds no neighbours for a rule alone in its set', () => {
		const { ids } = setupFindNeighbourRules({ ruleId: 'react-size' });

		expect(ids).toStrictEqual({ previous: undefined, next: undefined });
	});

	test('finds no neighbours for a rule the pack does not hold', () => {
		const { ids } = setupFindNeighbourRules({ ruleId: 'missing' });

		expect(ids).toStrictEqual({ previous: undefined, next: undefined });
	});
});
