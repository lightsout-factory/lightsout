import { describe, expect, test } from '@jest/globals';
import { setupSyntaxTreeInput } from '@lightsout/standards-testkit';
import { check } from './check.ts';

/** The lines the check reports for one source file, or none when it stays silent. */
const setupFindings = async ({ source, path = 'src/shipping/calculateShippingCost.ts' }: { source: string; path?: string }) => {
	const input = setupSyntaxTreeInput({ sources: [[path, source]] });
	const findings = await check.run({ inputs: { 'syntax-tree': input }, options: {} });

	return { findings };
};

describe('single-return check', () => {
	test('asks for parsed trees, since only the tree says which function a return belongs to', () => {
		expect(check.inputKinds).toStrictEqual(['syntax-tree']);
	});

	test('reports a branch that returns a computed result before the end, naming its line', async () => {
		const source = [
			'export const getCost = ({ weight, isExpress }: { weight: number; isExpress: boolean }): number => {',
			'\tif (isExpress) {',
			'\t\treturn weight * 3;',
			'\t}',
			'',
			'\treturn weight * 2;',
			'};',
		].join('\n');

		const { findings } = await setupFindings({ source });

		expect(findings).toStrictEqual([
			{
				siteKey: 'single-return:src/shipping/calculateShippingCost.ts',
				files: [{ path: 'src/shipping/calculateShippingCost.ts' }],
				detail: 'a `return` before the end of its function at line 3',
				guidance: 'Return once, at the end: assign the result in each branch and return it after them. Only a guard clause at the top returns early.',
			},
		]);
	});

	test('leaves a function that assigns in each branch and returns once at the end', async () => {
		const source = [
			'export const getCost = ({ weight, isExpress }: { weight: number; isExpress: boolean }): number => {',
			'\tlet cost = weight * 2;',
			'',
			'\tif (isExpress) {',
			'\t\tcost += weight;',
			'\t}',
			'',
			'\treturn cost;',
			'};',
		].join('\n');

		const { findings } = await setupFindings({ source });

		expect(findings).toStrictEqual([]);
	});

	test.each([
		{ returned: 'return undefined;', shape: 'undefined' },
		{ returned: 'return null;', shape: 'null' },
		{ returned: 'return;', shape: 'nothing' },
		{ returned: 'return [];', shape: 'an empty list' },
		{ returned: "throw new Error('no user');", shape: 'a thrown error' },
	])('leaves a guard clause at the top that hands back $shape', async ({ returned }) => {
		const source = [
			'export const getName = ({ user }: { user?: { name: string } }) => {',
			'\tif (user === undefined) {',
			`\t\t${returned}`,
			'\t}',
			'',
			'\tconst name = user.name.trim();',
			'',
			'\treturn name;',
			'};',
		].join('\n');

		const { findings } = await setupFindings({ source });

		expect(findings).toStrictEqual([]);
	});

	test('reports an early return that follows another statement, since a guard sits before everything else', async () => {
		const source = [
			'export const getName = ({ id }: { id: string }) => {',
			'\tconst user = findUser({ id });',
			'',
			'\tif (user === undefined) {',
			'\t\treturn undefined;',
			'\t}',
			'',
			'\treturn user.name;',
			'};',
		].join('\n');

		const { findings } = await setupFindings({ source });

		expect(findings.map(({ detail }) => detail)).toStrictEqual(['a `return` before the end of its function at line 5']);
	});

	test('reports a switch that returns from its cases', async () => {
		const source = [
			'export const getLabel = ({ action }: { action: string }): string => {',
			'\tswitch (action) {',
			"\t\tcase 'add':",
			"\t\t\treturn 'Added';",
			'\t\tdefault:',
			"\t\t\treturn 'Removed';",
			'\t}',
			'};',
		].join('\n');

		const { findings } = await setupFindings({ source });

		expect(findings.map(({ detail }) => detail)).toStrictEqual(['a `return` before the end of its function at lines 4, 6']);
	});

	test('leaves an arrow with an expression body, which returns exactly once', async () => {
		const { findings } = await setupFindings({ source: 'export const double = ({ value }: { value: number }): number => value * 2;\n' });

		expect(findings).toStrictEqual([]);
	});

	test('judges a nested function on its own returns, never on its parent', async () => {
		const source = [
			'export const getNames = ({ users }: { users: Array<{ name?: string }> }): string[] => {',
			'\tconst names = users.map((user) => {',
			'\t\treturn user.name ?? "";',
			'\t});',
			'',
			'\treturn names;',
			'};',
		].join('\n');

		const { findings } = await setupFindings({ source });

		expect(findings).toStrictEqual([]);
	});

	test('reports nothing when its input is missing rather than refusing', async () => {
		const findings = await check.run({ inputs: {}, options: {} });

		expect(findings).toStrictEqual([]);
	});
});
