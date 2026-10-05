import { describe, expect, test } from '@jest/globals';
import { StandardsSet } from '@lightsout/standards-contracts';
import { StandardsSeverity } from '#src/contracts/standardsCheck/StandardsSeverity.ts';
import { FixtureSide } from '#src/contracts/views/FixtureSide.ts';
import { RuleExampleKind } from '#src/contracts/views/RuleExampleKind.ts';
import type { StandardsPackBundle } from '#src/contracts/views/StandardsPackBundle.ts';
import { StandardsPackView } from '#src/contracts/views/StandardsPackView.ts';
import { toStandardsPackView } from '#src/views/toStandardsPackView.ts';

/** A library bundle of one pack, with or without its description and homepage, one topic and two rules, each rule carrying prose, fixture text and an example. */
const setupBundle = ({ described = true }: { described?: boolean } = {}) => {
	const bundle: StandardsPackBundle = {
		name: 'lightsout',
		...(described ? { description: 'The built-in library.', homepage: 'https://example.com/lightsout' } : {}),
		rootPath: '/repo/packages/lightsout-standards',
		built: false,
		totals: { rules: 2, deterministic: 1, agent: 1, topics: 1, packs: 1, withFixtures: 1 },
		packs: [
			{
				name: 'standards',
				address: 'lightsout/standards',
				description: 'Every bundled standard.',
				include: { packs: [], topics: ['lightsout/code/fractal/size'], rules: [] },
				topics: ['lightsout/code/fractal/size'],
				rules: [
					{ name: 'lightsout/function-size', severity: StandardsSeverity.Blocking, options: { lines: 40 } },
					{ name: 'lightsout/pure-functions', severity: StandardsSeverity.Advisory, options: {} },
				],
				totals: { rules: 2, deterministic: 1, agent: 1, topics: 1, tokens: 120 },
			},
		],
		topics: [
			{
				set: StandardsSet.Code,
				path: 'code/fractal/size',
				intro: '# Size\n\nBackground the rules share.',
				ruleIds: ['function-size', 'pure-functions'],
			},
		],
		rules: [
			{
				id: 'function-size',
				name: 'lightsout/function-size',
				set: StandardsSet.Code,
				documentPath: 'code/fractal/size',
				summary: 'Keep each function under its line cap.',
				deterministic: true,
				agent: false,
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
			{
				id: 'pure-functions',
				name: 'lightsout/pure-functions',
				set: StandardsSet.Code,
				documentPath: 'code/fractal/size',
				summary: 'Keep functions free of hidden side effects.',
				deterministic: false,
				agent: true,
				defaultSeverity: StandardsSeverity.Advisory,
				defaultOptions: {},
				fixtureCounts: { pass: 0, fail: 0 },
				prose: 'A function that writes state it was not handed surprises its caller.',
				fixtures: [],
				example: { kind: RuleExampleKind.Repo, focus: { pass: 'src/a.ts', fail: 'src/b.ts' } },
			},
		],
	};

	return { bundle };
};

describe('toStandardsPackView', () => {
	test("projects the library bundle without any rule's prose or fixture text", () => {
		const { bundle } = setupBundle();

		const view = toStandardsPackView({ bundle });

		expect(view).toStrictEqual({
			name: 'lightsout',
			description: 'The built-in library.',
			homepage: 'https://example.com/lightsout',
			rootPath: '/repo/packages/lightsout-standards',
			built: false,
			totals: { rules: 2, deterministic: 1, agent: 1, topics: 1, packs: 1, withFixtures: 1 },
			packs: [
				{
					name: 'standards',
					address: 'lightsout/standards',
					description: 'Every bundled standard.',
					include: { packs: [], topics: ['lightsout/code/fractal/size'], rules: [] },
					topics: ['lightsout/code/fractal/size'],
					rules: [
						{ name: 'lightsout/function-size', severity: 'blocking', options: { lines: 40 } },
						{ name: 'lightsout/pure-functions', severity: 'advisory', options: {} },
					],
					totals: { rules: 2, deterministic: 1, agent: 1, topics: 1, tokens: 120 },
				},
			],
			topics: [
				{
					set: 'code',
					path: 'code/fractal/size',
					intro: '# Size\n\nBackground the rules share.',
					ruleIds: ['function-size', 'pure-functions'],
				},
			],
			rules: [
				{
					id: 'function-size',
					name: 'lightsout/function-size',
					set: 'code',
					documentPath: 'code/fractal/size',
					summary: 'Keep each function under its line cap.',
					deterministic: true,
					agent: false,
					defaultSeverity: 'advisory',
					defaultOptions: { lines: 50 },
					fixtureCounts: { pass: 1, fail: 1 },
				},
				{
					id: 'pure-functions',
					name: 'lightsout/pure-functions',
					set: 'code',
					documentPath: 'code/fractal/size',
					summary: 'Keep functions free of hidden side effects.',
					deterministic: false,
					agent: true,
					defaultSeverity: 'advisory',
					defaultOptions: {},
					fixtureCounts: { pass: 0, fail: 0 },
				},
			],
		});
	});

	test('leaves out the description and homepage a library does not declare', () => {
		const { bundle } = setupBundle({ described: false });

		const view = toStandardsPackView({ bundle });

		expect({ description: Object.hasOwn(view, 'description'), homepage: Object.hasOwn(view, 'homepage') }).toStrictEqual({
			description: false,
			homepage: false,
		});
	});

	test('produces a view the StandardsPackView contract takes back unchanged', () => {
		const { bundle } = setupBundle();

		const view = toStandardsPackView({ bundle });
		const parsed = StandardsPackView.parse(view);

		expect(parsed).toStrictEqual(view);
	});
});
