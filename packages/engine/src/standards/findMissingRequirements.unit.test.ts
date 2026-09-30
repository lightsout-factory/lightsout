import { describe, expect, test } from '@jest/globals';
import { StandardsSeverity } from '#src/contracts/standardsCheck/StandardsSeverity.ts';
import { findMissingRequirements } from '#src/standards/findMissingRequirements.ts';
import type { ResolvedRuleState } from '#src/standardsCheck/common/types/ResolvedRuleState.ts';
import type { LoadedStandardsRule } from '#src/standardsLibraries/common/types/LoadedStandardsRule.ts';
import type { ResolvedPackRule } from '#src/standardsLibraries/common/types/ResolvedPackRule.ts';

/** A loaded rule `house/<id>` with its requires list and every other field at a neutral value. */
const rule = ({ id, requires }: { id: string; requires: string[] }): LoadedStandardsRule => ({
	id,
	name: `house/${id}`,
	library: 'house',
	set: 'code',
	documentPath: 'code/demo',
	summary: 'a rule',
	prose: 'the argument for the rule',
	channel: 'base',
	checked: false,
	defaultSeverity: StandardsSeverity.Advisory,
	defaultOptions: {},
	fixturesPath: `/packages/house/${id}/fixtures`,
	requires,
});

interface PackRuleSpec {
	id: string;
	severity: StandardsSeverity;
	requires?: string[];
}

interface StateSpec {
	severity: StandardsSeverity;
	fromConfig: boolean;
	reachesAgents: boolean;
}

/** The rules a resolved pack holds, each at the severity the spec gives it. */
const packRules = ({ specs }: { specs: PackRuleSpec[] }): ResolvedPackRule[] =>
	specs.map(({ id, severity, requires = [] }) => ({ rule: rule({ id, requires }), severity, options: {} }));

/** The repo's final rule states, keyed by the full name `house/<id>`. */
const ruleStates = ({ states }: { states: Record<string, StateSpec> }): Map<string, ResolvedRuleState> =>
	new Map(Object.entries(states).map(([id, state]) => [`house/${id}`, { ...state, options: {} }]));

describe('findMissingRequirements', () => {
	test('reports a required rule the pack does not hold', () => {
		const scenarios = [
			{
				rules: packRules({
					specs: [
						{ id: 'a', severity: StandardsSeverity.Advisory, requires: ['house/b'] },
						{ id: 'b', severity: StandardsSeverity.Blocking },
					],
				}),
			},
			{ rules: packRules({ specs: [{ id: 'a', severity: StandardsSeverity.Advisory, requires: ['house/b'] }] }) },
		];

		const results = scenarios.map(({ rules }) => findMissingRequirements({ rules }));

		expect(results).toStrictEqual([[], [{ rule: 'house/a', required: 'house/b' }]]);
	});

	test('treats a publisher-off required rule as missing unless its state reaches agents', () => {
		const rules = packRules({
			specs: [
				{ id: 'a', severity: StandardsSeverity.Advisory, requires: ['house/b'] },
				{ id: 'b', severity: StandardsSeverity.Off },
			],
		});
		const a = { severity: StandardsSeverity.Advisory, fromConfig: false, reachesAgents: true };
		const scenarios = [
			{ states: undefined },
			{
				states: ruleStates({
					states: { a, b: { severity: StandardsSeverity.Advisory, fromConfig: true, reachesAgents: true } },
				}),
			},
			{
				states: ruleStates({
					states: { a, b: { severity: StandardsSeverity.Advisory, fromConfig: true, reachesAgents: false } },
				}),
			},
		];

		const results = scenarios.map(({ states }) => findMissingRequirements({ rules, states }));

		expect(results).toStrictEqual([[{ rule: 'house/a', required: 'house/b' }], [], [{ rule: 'house/a', required: 'house/b' }]]);
	});

	test('does not report a required rule the repo set to off when the pack sends it', () => {
		const rules = packRules({
			specs: [
				{ id: 'a', severity: StandardsSeverity.Advisory, requires: ['house/b'] },
				{ id: 'b', severity: StandardsSeverity.Blocking },
			],
		});
		const states = ruleStates({
			states: {
				a: { severity: StandardsSeverity.Advisory, fromConfig: false, reachesAgents: true },
				b: { severity: StandardsSeverity.Off, fromConfig: true, reachesAgents: true },
			},
		});

		const missing = findMissingRequirements({ rules, states });

		expect(missing).toStrictEqual([]);
	});

	test('ignores the requirements of a rule that does not reach agents', () => {
		const rules = packRules({ specs: [{ id: 'a', severity: StandardsSeverity.Off, requires: ['house/b'] }] });
		const scenarios = [
			{ states: undefined },
			{
				states: ruleStates({
					states: { a: { severity: StandardsSeverity.Off, fromConfig: false, reachesAgents: false } },
				}),
			},
		];

		const results = scenarios.map(({ states }) => findMissingRequirements({ rules, states }));

		expect(results).toStrictEqual([[], []]);
	});
});
