import { describe, expect, test } from '@jest/globals';
import type { LoadedStandardsRule } from '#src/common/types/LoadedStandardsRule.ts';
import { StandardsSeverity } from '#src/contracts/standardsCheck/StandardsSeverity.ts';
import { resolveRuleName } from '#src/standardsLibraries/resolveRuleName.ts';

/** A loaded rule `<library>/<id>` with every other field at a neutral value. */
const rule = ({ library, id }: { library: string; id: string }): LoadedStandardsRule => ({
	id,
	name: `${library}/${id}`,
	library,
	set: 'code',
	documentPath: 'code/demo',
	summary: 'a rule',
	prose: 'the argument for the rule',
	deterministic: false,
	agent: true,
	defaultSeverity: StandardsSeverity.Advisory,
	defaultOptions: {},
	requires: [],
	fixturesPath: `/packages/${library}/${id}/fixtures`,
});

/** The rules in scope, each written as its full name `<library>/<id>`. */
const setupRules = ({ names }: { names: string[] }) => {
	const rules = names.map((name) => {
		const [library = '', id = ''] = name.split('/');

		return rule({ library, id });
	});

	return { rules };
};

describe('resolveRuleName', () => {
	test('a full name resolves to the rule whose library and id it spells', () => {
		const { rules } = setupRules({ names: ['lightsout/size', 'acme/size'] });

		const resolved = resolveRuleName({ name: 'acme/size', rules });

		expect(resolved).toStrictEqual({ rule: rules[1] });
	});

	test('a short id held by exactly one rule in scope resolves to that rule', () => {
		const { rules } = setupRules({ names: ['acme/size', 'lightsout/naming'] });

		const resolved = resolveRuleName({ name: 'size', rules });

		expect(resolved).toStrictEqual({ rule: rules[0] });
	});

	test('a short id two libraries share returns a problem naming every full candidate', () => {
		const { rules } = setupRules({ names: ['lightsout/size', 'acme/size'] });

		const resolved = resolveRuleName({ name: 'size', rules });

		expect(resolved).toEqual({ problem: expect.stringMatching(/acme\/size[\s\S]*lightsout\/size/) });
	});

	test('a name matching no rule in scope returns a problem naming it', () => {
		const { rules } = setupRules({ names: ['acme/size'] });

		const resolved = ['nope', 'acme/nope'].map((name) => resolveRuleName({ name, rules }));

		expect(resolved).toEqual([{ problem: expect.stringContaining('nope') }, { problem: expect.stringContaining('acme/nope') }]);
	});

	test('a full name whose library holds no such rule is not resolved through its short id', () => {
		const { rules } = setupRules({ names: ['acme/size'] });

		const resolved = resolveRuleName({ name: 'other/size', rules });

		expect(resolved).toEqual({ problem: expect.stringContaining('other/size') });
	});
});
