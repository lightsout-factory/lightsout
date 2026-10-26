import { describe, expect, test } from '@jest/globals';
import type { LoadedStandardsRule } from '#src/common/types/LoadedStandardsRule.ts';
import type { ResolvedStandardsPack } from '#src/common/types/ResolvedStandardsPack.ts';
import type { StandardsRuleSettings } from '#src/contracts/StandardsRuleSettings.ts';
import { StandardsSeverity } from '#src/contracts/standardsCheck/StandardsSeverity.ts';
import { resolveRuleStates } from '#src/standards/resolveStandardsGroups/resolveRuleStates.ts';
import { setupStandardsLibraries } from '#tests/helpers/setupStandardsLibraries.ts';

interface PackRuleSpec {
	id: string;
	/** The grade the resolved pack gives the rule. */
	severity: StandardsSeverity;
	/** The options the resolved pack gives the rule; none when omitted. */
	options?: Record<string, number>;
	/** The globs the resolved pack excludes for the rule; none when omitted. */
	exclude?: string[];
}

interface PackSpec {
	/** File stem in the acme library — the pack's address is `acme/<name>`. */
	name: string;
	rules: PackRuleSpec[];
}

const findRule = ({ rules, name }: { rules: LoadedStandardsRule[]; name: string }): LoadedStandardsRule => {
	const found = rules.find((rule) => rule.name === name);

	if (found === undefined) {
		throw new Error(`the test library holds no rule named ${name}`);
	}

	return found;
};

/** Resolved packs built straight from their grades and excludes, over rules loaded from an in-memory acme library. */
const setupPacks = ({ packs }: { packs: PackSpec[] }): { packs: ResolvedStandardsPack[] } => {
	const ids = [...new Set(packs.flatMap((pack) => pack.rules.map((spec) => spec.id)))];
	const { libraries } = setupStandardsLibraries({
		libraries: [
			{
				name: 'acme',
				topics: [{ path: 'code/demo', rules: ids.map((id) => ({ id, severity: StandardsSeverity.Off, options: { fromRuleMd: 9 } })) }],
			},
		],
	});
	const rules = libraries.flatMap((library) => library.rules);

	return {
		packs: packs.map((pack) => ({
			name: `acme/${pack.name}`,
			topics: [],
			rules: pack.rules.map((spec) => ({
				rule: findRule({ rules, name: `acme/${spec.id}` }),
				severity: spec.severity,
				options: spec.options ?? {},
				exclude: spec.exclude ?? [],
			})),
			conditionalPacks: [],
			inactiveRules: [],
		})),
	};
};

describe('resolveRuleStates excludes', () => {
	test("resolveRuleStates: the pack's excludes and the repo's excludes are kept apart on the state", () => {
		const { packs } = setupPacks({
			packs: [{ name: 'web', rules: [{ id: 'placement', severity: StandardsSeverity.Advisory, exclude: ['src/routes/**'] }] }],
		});

		const states = resolveRuleStates({ packs, ruleSettings: { placement: { exclude: ['packages/web/legacy/**'] } } });

		expect(states).toStrictEqual([
			new Map([
				[
					'acme/placement',
					{
						severity: 'advisory',
						options: {},
						fromConfig: false,
						reachesAgents: true,
						packExclude: ['src/routes/**'],
						repoExclude: ['packages/web/legacy/**'],
					},
				],
			]),
		]);
	});

	test('resolveRuleStates: an exclude-only entry changes no grade and is not marked from config', () => {
		const { packs } = setupPacks({
			packs: [{ name: 'house', rules: [{ id: 'size', severity: StandardsSeverity.Blocking, options: { a: 1, b: 2 } }] }],
		});
		const entries: StandardsRuleSettings[] = [
			{ size: { exclude: ['gen/**'] } },
			{ size: { severity: StandardsSeverity.Advisory, exclude: ['gen/**'] } },
			{ size: { options: { b: 5 }, exclude: ['gen/**'] } },
		];

		const states = entries.map((ruleSettings) => resolveRuleStates({ packs, ruleSettings }));

		expect(states).toStrictEqual([
			[
				new Map([
					['acme/size', { severity: 'blocking', options: { a: 1, b: 2 }, fromConfig: false, reachesAgents: true, packExclude: [], repoExclude: ['gen/**'] }],
				]),
			],
			[
				new Map([
					['acme/size', { severity: 'advisory', options: { a: 1, b: 2 }, fromConfig: true, reachesAgents: true, packExclude: [], repoExclude: ['gen/**'] }],
				]),
			],
			[
				new Map([
					['acme/size', { severity: 'blocking', options: { a: 1, b: 5 }, fromConfig: true, reachesAgents: true, packExclude: [], repoExclude: ['gen/**'] }],
				]),
			],
		]);
	});

	test('resolveRuleStates: a repo exclude applies to every pack holding the rule', () => {
		const { packs } = setupPacks({
			packs: [
				{ name: 'house', rules: [{ id: 'size', severity: StandardsSeverity.Blocking, exclude: ['src/routes/**'] }] },
				{ name: 'lean', rules: [{ id: 'size', severity: StandardsSeverity.Advisory }] },
				{ name: 'other', rules: [{ id: 'boundary', severity: StandardsSeverity.Blocking }] },
			],
		});

		const states = resolveRuleStates({ packs, ruleSettings: { size: { exclude: ['packages/web/legacy/**'] } } });

		expect(states).toStrictEqual([
			new Map([
				[
					'acme/size',
					{
						severity: 'blocking',
						options: {},
						fromConfig: false,
						reachesAgents: true,
						packExclude: ['src/routes/**'],
						repoExclude: ['packages/web/legacy/**'],
					},
				],
			]),
			new Map([
				['acme/size', { severity: 'advisory', options: {}, fromConfig: false, reachesAgents: true, packExclude: [], repoExclude: ['packages/web/legacy/**'] }],
			]),
			new Map([['acme/boundary', { severity: 'blocking', options: {}, fromConfig: false, reachesAgents: true, packExclude: [], repoExclude: [] }]]),
		]);
	});
});
