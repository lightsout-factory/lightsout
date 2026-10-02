import { describe, expect, test } from '@jest/globals';
import { StandardsSet } from '@lightsout/standards-contracts';
import { StandardsSeverity } from '#src/contracts/standardsCheck/StandardsSeverity.ts';
import { FixtureSide } from '#src/contracts/views/FixtureSide.ts';
import { RuleExampleKind } from '#src/contracts/views/RuleExampleKind.ts';
import type { StandardsPackBundle } from '#src/contracts/views/StandardsPackBundle.ts';
import { toStandardsPackRuleView } from '#src/views/common/utils/toStandardsPackRuleView.ts';
import { StandardsPackRuleNotFoundError } from '#src/views/StandardsPackRuleNotFoundError.ts';

/** A library bundle of one topic and one rule, `function-size`, carrying its prose and fixture text. */
const setupBundle = () => {
	const bundle: StandardsPackBundle = {
		name: 'lightsout',
		rootPath: '/repo/packages/lightsout-standards',
		built: false,
		totals: { rules: 1, checked: 1, judgment: 0, topics: 1, packs: 0, withFixtures: 1 },
		packs: [],
		topics: [{ set: StandardsSet.Code, path: 'code/fractal/size', intro: '# Size\n', ruleIds: ['function-size'] }],
		rules: [
			{
				id: 'function-size',
				name: 'lightsout/function-size',
				set: StandardsSet.Code,
				documentPath: 'code/fractal/size',
				summary: 'Keep each function under its line cap.',
				checked: true,
				reviewed: false,
				defaultSeverity: StandardsSeverity.Advisory,
				defaultOptions: { lines: 50 },
				fixtureCounts: { pass: 1, fail: 1 },
				prose: 'Long functions hide their intent.',
				fixtures: [
					{ side: FixtureSide.Pass, path: 'src/short.ts', text: 'export const short = () => 1;' },
					{ side: FixtureSide.Fail, path: 'src/long.ts', text: 'export const long = () => {};' },
				],
				example: { kind: RuleExampleKind.Snippet },
			},
		],
	};

	return { bundle };
};

describe('toStandardsPackRuleView', () => {
	test('returns the rule a page address names by its short id, prose and fixtures included', () => {
		const { bundle } = setupBundle();

		const view = toStandardsPackRuleView({ bundle, rule: 'function-size' });

		expect({ name: view.name, prose: view.prose, fixtures: view.fixtures.map((fixture) => fixture.path) }).toStrictEqual({
			name: 'lightsout/function-size',
			prose: 'Long functions hide their intent.',
			fixtures: ['src/short.ts', 'src/long.ts'],
		});
	});

	test.each([{ rule: 'lightsout/function-size' }, { rule: 'no-such-rule' }])(
		'throws a not-found error naming $rule when no rule carries that short id',
		({ rule }) => {
			const { bundle } = setupBundle();

			const act = () => toStandardsPackRuleView({ bundle, rule });

			expect(act).toThrow(StandardsPackRuleNotFoundError);
			expect(act).toThrow(`"lightsout" holds no rule named "${rule}"`);
		},
	);
});
