import { describe, expect, test } from '@jest/globals';
import type { LoadedStandardsRule } from '#src/common/types/LoadedStandardsRule.ts';
import type { ResolvedPackRule } from '#src/common/types/ResolvedPackRule.ts';
import type { ResolvedRuleState } from '#src/common/types/ResolvedRuleState.ts';
import type { StandardsGroup } from '#src/common/types/StandardsGroup.ts';
import { StandardsSeverity } from '#src/contracts/standardsCheck/StandardsSeverity.ts';
import { listStandardsRules } from '#src/standardsCheck/listStandardsRules.ts';

/** A loaded rule held in memory — the group listing reads rules the pack already resolved, never a folder. */
const loadedRule = (overrides: Partial<LoadedStandardsRule> & { id: string; library: string }): LoadedStandardsRule => ({
	name: `${overrides.library}/${overrides.id}`,
	set: 'code',
	documentPath: 'code/demo',
	summary: `what ${overrides.id} catches`,
	prose: 'The rule prose.',
	deterministic: false,
	agent: overrides.deterministic !== true,
	defaultSeverity: StandardsSeverity.Advisory,
	defaultOptions: {},
	requires: [],
	fixturesPath: `/packages/${overrides.library}/${overrides.id}/fixtures`,
	...overrides,
});

/**
 * One group whose pack holds two rules from two libraries, listed out of name
 * order. The checked rule's rule.md default, its pack grade and its final state
 * all differ, so a row can only match by reading the state.
 */
const setupGroup = () => {
	const aardvark = loadedRule({ id: 'aardvark-rule', library: 'team', set: 'tests', documentPath: 'tests/demo' });
	const zebra = loadedRule({
		id: 'zebra-rule',
		library: 'acme',
		deterministic: true,
		agent: false,
		defaultSeverity: StandardsSeverity.Off,
		defaultOptions: { maxLines: 10 },
	});
	const packRules: ResolvedPackRule[] = [
		{ rule: aardvark, severity: StandardsSeverity.Advisory, options: {} },
		{ rule: zebra, severity: StandardsSeverity.Advisory, options: { maxLines: 40 } },
	];
	const states = new Map<string, ResolvedRuleState>([
		['team/aardvark-rule', { severity: StandardsSeverity.Advisory, options: {}, fromConfig: false, reachesAgents: true }],
		['acme/zebra-rule', { severity: StandardsSeverity.Blocking, options: { maxLines: 60 }, fromConfig: true, reachesAgents: true }],
	]);
	const groups: StandardsGroup[] = [
		{ packages: [''], pack: { name: 'acme/house', topics: [], rules: packRules, conditionalPacks: [], inactiveRules: [] }, states },
	];

	return { groups };
};

/**
 * Two groups that split the workspace: the repo root and engine on one pack,
 * web-app on another. Both packs hold both rules; alpha-rule resolves to the
 * same state in each, and beta-rule is blocking in the wider group but
 * advisory in web-app's.
 */
const setupSplitGroups = () => {
	const alpha = loadedRule({ id: 'alpha-rule', library: 'acme' });
	const beta = loadedRule({ id: 'beta-rule', library: 'acme', deterministic: true });
	const packRules: ResolvedPackRule[] = [
		{ rule: alpha, severity: StandardsSeverity.Advisory, options: {} },
		{ rule: beta, severity: StandardsSeverity.Advisory, options: { maxLines: 40 } },
	];
	const alphaState: ResolvedRuleState = { severity: StandardsSeverity.Advisory, options: {}, fromConfig: false, reachesAgents: true };
	const rootStates = new Map<string, ResolvedRuleState>([
		['acme/alpha-rule', alphaState],
		['acme/beta-rule', { severity: StandardsSeverity.Blocking, options: { maxLines: 40 }, fromConfig: false, reachesAgents: true }],
	]);
	const webAppStates = new Map<string, ResolvedRuleState>([
		['acme/alpha-rule', alphaState],
		['acme/beta-rule', { severity: StandardsSeverity.Advisory, options: { maxLines: 40 }, fromConfig: false, reachesAgents: true }],
	]);
	const groups: StandardsGroup[] = [
		{ packages: ['', 'engine'], pack: { name: 'acme/base', topics: [], rules: packRules, conditionalPacks: [], inactiveRules: [] }, states: rootStates },
		{ packages: ['web-app'], pack: { name: 'acme/web', topics: [], rules: packRules, conditionalPacks: [], inactiveRules: [] }, states: webAppStates },
	];

	return { groups };
};

describe('listStandardsRules', () => {
	test("listStandardsRules: lists the groups' pack rules at their resolved state", () => {
		const { groups } = setupGroup();

		const listed = listStandardsRules({ groups });
		const unlisted = listStandardsRules({ groups: [] });

		// the severity, options and config mark are the group's final state, not
		// the rule.md defaults nor the pack's own grade; the doc names the library
		// that states each rule; and the rows read as one list sorted by full name
		expect({ listed, unlisted }).toStrictEqual({
			listed: [
				{
					rule: 'acme/zebra-rule',
					doc: 'acme: code/demo',
					summary: 'what zebra-rule catches',
					deterministic: true,
					agent: false,
					severity: StandardsSeverity.Blocking,
					fromConfig: true,
					options: { maxLines: 60 },
					packages: [''],
				},
				{
					rule: 'team/aardvark-rule',
					doc: 'team: tests/demo',
					summary: 'what aardvark-rule catches',
					deterministic: false,
					agent: true,
					severity: StandardsSeverity.Advisory,
					fromConfig: false,
					options: {},
					packages: [''],
				},
			],
			unlisted: [],
		});
	});

	test('a rule two groups hold is listed once, by full name', () => {
		const { groups } = setupGroup();

		const listed = listStandardsRules({ groups: [...groups, ...groups] });

		expect(listed.map((listing) => listing.rule)).toStrictEqual(['acme/zebra-rule', 'team/aardvark-rule']);
	});

	test('lists a rule once per distinct state, naming the packages each state applies to', () => {
		const { groups } = setupSplitGroups();

		const listed = listStandardsRules({ groups });

		// a rule at one state everywhere is one row covering every package; a rule
		// graded differently per package is one row per grade, the wider set first
		expect(listed).toStrictEqual([
			{
				rule: 'acme/alpha-rule',
				doc: 'acme: code/demo',
				summary: 'what alpha-rule catches',
				deterministic: false,
				agent: true,
				severity: StandardsSeverity.Advisory,
				fromConfig: false,
				options: {},
				packages: ['', 'engine', 'web-app'],
			},
			{
				rule: 'acme/beta-rule',
				doc: 'acme: code/demo',
				summary: 'what beta-rule catches',
				deterministic: true,
				agent: false,
				severity: StandardsSeverity.Blocking,
				fromConfig: false,
				options: { maxLines: 40 },
				packages: ['', 'engine'],
			},
			{
				rule: 'acme/beta-rule',
				doc: 'acme: code/demo',
				summary: 'what beta-rule catches',
				deterministic: true,
				agent: false,
				severity: StandardsSeverity.Advisory,
				fromConfig: false,
				options: { maxLines: 40 },
				packages: ['web-app'],
			},
		]);
	});
});
