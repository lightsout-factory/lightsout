import { describe, expect, test } from '@jest/globals';
import { messageOf } from '#src/common/utils/messageOf.ts';
import type { StandardsRuleSettings } from '#src/contracts/StandardsRuleSettings.ts';
import { StandardsSeverity } from '#src/contracts/standardsCheck/StandardsSeverity.ts';
import { resolveRuleStates } from '#src/standards/internal/resolveRuleStates.ts';
import type { LoadedStandardsRule } from '#src/standardsLibraries/common/types/LoadedStandardsRule.ts';
import type { ResolvedStandardsPack } from '#src/standardsLibraries/common/types/ResolvedStandardsPack.ts';
import { setupStandardsLibraries } from '#tests/helpers/setupStandardsLibraries.ts';

interface PackRuleSpec {
	/** The library defining the rule; 'acme' when omitted. */
	library?: string;
	id: string;
	/** The grade the resolved pack gives the rule. */
	severity: StandardsSeverity;
	/** The options the resolved pack gives the rule; none when omitted. */
	options?: Record<string, number>;
}

interface PackSpec {
	/** File stem in the acme library — the pack's address is `acme/<name>`. */
	name: string;
	rules: PackRuleSpec[];
	/** Ids of acme rules only a conditional pack that did not apply would have brought; none when omitted. */
	inactive?: string[];
}

/**
 * Every rule's rule.md default is `off` with a `fromRuleMd` option, which no pack
 * below ever gives — so a state that started from the rule.md defaults instead of
 * the pack's grade would show it.
 */
const ruleMdSeverity = StandardsSeverity.Off;
const ruleMdOptions = { fromRuleMd: 9 };

const findRule = ({ rules, name }: { rules: LoadedStandardsRule[]; name: string }): LoadedStandardsRule => {
	const found = rules.find((rule) => rule.name === name);

	if (found === undefined) {
		throw new Error(`the test library holds no rule named ${name}`);
	}

	return found;
};

/** Resolved packs built straight from their grades, over rules loaded from in-memory libraries. */
const setupPacks = ({ packs }: { packs: PackSpec[] }): { packs: ResolvedStandardsPack[] } => {
	const specs = packs.flatMap((pack) => [...pack.rules, ...(pack.inactive ?? []).map((id) => ({ id, library: 'acme' }))]);
	const libraryNames = [...new Set(specs.map((spec) => spec.library ?? 'acme'))];
	const { libraries } = setupStandardsLibraries({
		libraries: libraryNames.map((name) => ({
			name,
			topics: [
				{
					path: 'code/demo',
					rules: [...new Set(specs.filter((spec) => (spec.library ?? 'acme') === name).map((spec) => spec.id))].map((id) => ({
						id,
						severity: ruleMdSeverity,
						options: ruleMdOptions,
					})),
				},
			],
		})),
	});
	const rules = libraries.flatMap((library) => library.rules);

	return {
		packs: packs.map((pack) => ({
			name: `acme/${pack.name}`,
			topics: [],
			rules: pack.rules.map((spec) => ({
				rule: findRule({ rules, name: `${spec.library ?? 'acme'}/${spec.id}` }),
				severity: spec.severity,
				options: spec.options ?? {},
			})),
			conditionalPacks: [],
			inactiveRules: (pack.inactive ?? []).map((id) => findRule({ rules, name: `acme/${id}` })),
		})),
	};
};

/** The message `resolveRuleStates` threw, or a note that it did not throw — so one act can try several entries. */
const attemptMessage = ({ packs, ruleSettings }: { packs: ResolvedStandardsPack[]; ruleSettings: StandardsRuleSettings }): string => {
	let message = 'resolveRuleStates did not throw';

	try {
		resolveRuleStates({ packs, ruleSettings });
	} catch (error) {
		message = messageOf({ error });
	}

	return message;
};

/** Matches a message holding every part, in any order. */
const containsAll = (...parts: string[]) => {
	const lookaheads = parts.map((part) => {
		const literal = part.replace(/[.*+?^$()|[\]\\{}]/g, '\\$&');

		return `(?=[\\s\\S]*${literal})`;
	});

	return new RegExp(lookaheads.join(''));
};

describe('resolveRuleStates', () => {
	test("resolveRuleStates: with no repo settings every state is the pack's own severity and options", () => {
		const { packs } = setupPacks({
			packs: [
				{
					name: 'house',
					rules: [
						{ id: 'size', severity: StandardsSeverity.Advisory, options: { a: 1, b: 2 } },
						{ id: 'boundary', severity: StandardsSeverity.Blocking },
						{ id: 'opt-in', severity: StandardsSeverity.Off, options: { c: 3 } },
					],
				},
			],
		});

		const states = resolveRuleStates({ packs, ruleSettings: undefined });

		expect(states).toStrictEqual([
			new Map([
				['acme/size', { severity: 'advisory', options: { a: 1, b: 2 }, fromConfig: false, reachesAgents: true }],
				['acme/boundary', { severity: 'blocking', options: {}, fromConfig: false, reachesAgents: true }],
				['acme/opt-in', { severity: 'off', options: { c: 3 }, fromConfig: false, reachesAgents: false }],
			]),
		]);
	});

	test('resolveRuleStates: a severity-only entry changes the severity and leaves the options alone', () => {
		const { packs } = setupPacks({
			packs: [{ name: 'house', rules: [{ id: 'size', severity: StandardsSeverity.Blocking, options: { a: 1, b: 2 } }] }],
		});

		const states = resolveRuleStates({ packs, ruleSettings: { size: 'advisory' } });

		expect(states).toStrictEqual([new Map([['acme/size', { severity: 'advisory', options: { a: 1, b: 2 }, fromConfig: true, reachesAgents: true }]])]);
	});

	test("resolveRuleStates: repo options merge key by key over the pack's options", () => {
		const { packs } = setupPacks({
			packs: [{ name: 'house', rules: [{ id: 'size', severity: StandardsSeverity.Blocking, options: { a: 1, b: 2 } }] }],
		});

		const states = resolveRuleStates({ packs, ruleSettings: { size: { options: { b: 5 } } } });

		expect(states).toStrictEqual([new Map([['acme/size', { severity: 'blocking', options: { a: 1, b: 5 }, fromConfig: true, reachesAgents: true }]])]);
	});

	test('resolveRuleStates: a repo off stops the rule running but keeps its prose for agents', () => {
		const { packs } = setupPacks({
			packs: [{ name: 'house', rules: [{ id: 'boundary', severity: StandardsSeverity.Blocking }] }],
		});

		const states = resolveRuleStates({ packs, ruleSettings: { boundary: 'off' } });

		expect(states).toStrictEqual([new Map([['acme/boundary', { severity: 'off', options: {}, fromConfig: true, reachesAgents: true }]])]);
	});

	test('resolveRuleStates: only blocking or advisory turns on a rule the pack ships off', () => {
		const { packs } = setupPacks({
			packs: [
				{
					name: 'house',
					rules: [
						{ id: 'turned-advisory', severity: StandardsSeverity.Off },
						{ id: 'turned-blocking', severity: StandardsSeverity.Off },
						{ id: 'kept-off', severity: StandardsSeverity.Off },
					],
				},
			],
		});

		const states = resolveRuleStates({
			packs,
			ruleSettings: { 'turned-advisory': 'advisory', 'turned-blocking': 'blocking', 'kept-off': 'off' },
		});

		expect(states).toStrictEqual([
			new Map([
				['acme/turned-advisory', { severity: 'advisory', options: {}, fromConfig: true, reachesAgents: true }],
				['acme/turned-blocking', { severity: 'blocking', options: {}, fromConfig: true, reachesAgents: true }],
				['acme/kept-off', { severity: 'off', options: {}, fromConfig: true, reachesAgents: false }],
			]),
		]);
	});

	test('resolveRuleStates: a unique short name reaches the same rule as its full name', () => {
		const { packs } = setupPacks({
			packs: [
				{ name: 'house', rules: [{ id: 'size', severity: StandardsSeverity.Blocking, options: { a: 1 } }] },
				{ name: 'guest', rules: [{ library: 'beta', id: 'boundary', severity: StandardsSeverity.Blocking }] },
			],
		});
		const entries: StandardsRuleSettings[] = [{ size: 'advisory' }, { 'acme/size': 'advisory' }];

		const states = entries.map((ruleSettings) => resolveRuleStates({ packs, ruleSettings }));

		const expected = [
			new Map([['acme/size', { severity: 'advisory', options: { a: 1 }, fromConfig: true, reachesAgents: true }]]),
			new Map([['beta/boundary', { severity: 'blocking', options: {}, fromConfig: false, reachesAgents: true }]]),
		];
		expect(states).toStrictEqual([expected, expected]);
	});

	test('resolveRuleStates: an unknown or ambiguous entry fails and names the key and the entry', () => {
		const { packs } = setupPacks({
			packs: [
				{
					name: 'house',
					rules: [
						{ id: 'size', severity: StandardsSeverity.Blocking },
						{ id: 'shared', severity: StandardsSeverity.Blocking },
						{ library: 'beta', id: 'shared', severity: StandardsSeverity.Advisory },
					],
				},
			],
		});
		const entries: StandardsRuleSettings[] = [{ 'no-such-rule': 'off' }, { shared: 'off' }];

		const messages = entries.map((ruleSettings) => attemptMessage({ packs, ruleSettings }));

		expect(messages).toEqual([
			expect.stringMatching(containsAll('standards-rule-settings', 'no-such-rule')),
			expect.stringMatching(containsAll('standards-rule-settings', 'shared', 'acme/shared', 'beta/shared')),
		]);
	});

	test('resolveRuleStates: an entry naming a rule only an unapplied conditional pack holds is accepted and changes nothing', () => {
		const { packs } = setupPacks({
			packs: [{ name: 'house', rules: [{ id: 'size', severity: StandardsSeverity.Blocking, options: { a: 1 } }], inactive: ['hooks-first'] }],
		});

		const states = resolveRuleStates({ packs, ruleSettings: { 'hooks-first': 'advisory' } });

		// hooks-first gets no state, and size keeps the pack's grade with nothing from config
		expect(states).toStrictEqual([new Map([['acme/size', { severity: 'blocking', options: { a: 1 }, fromConfig: false, reachesAgents: true }]])]);
	});

	test('resolveRuleStates: an entry applies only to the packs that hold the rule', () => {
		const { packs } = setupPacks({
			packs: [
				{
					name: 'house',
					rules: [
						{ id: 'size', severity: StandardsSeverity.Blocking, options: { a: 1 } },
						{ id: 'boundary', severity: StandardsSeverity.Blocking },
					],
				},
				{ name: 'lean', rules: [{ id: 'boundary', severity: StandardsSeverity.Advisory }] },
			],
		});

		const states = resolveRuleStates({ packs, ruleSettings: { size: 'advisory' } });

		expect(states).toStrictEqual([
			new Map([
				['acme/size', { severity: 'advisory', options: { a: 1 }, fromConfig: true, reachesAgents: true }],
				['acme/boundary', { severity: 'blocking', options: {}, fromConfig: false, reachesAgents: true }],
			]),
			new Map([['acme/boundary', { severity: 'advisory', options: {}, fromConfig: false, reachesAgents: true }]]),
		]);
	});
});
