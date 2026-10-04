import { describe, expect, jest, test } from '@jest/globals';
import { printStandardsRuleList } from '#src/cli/standardsCheckCommand/printStandardsRuleList.ts';
import type { StandardsRuleListing } from '#src/common/types/StandardsRuleListing.ts';
import { describePackageSet } from '#src/common/workspace/describePackageSet.ts';
import { StandardsSeverity } from '#src/contracts/standardsCheck/StandardsSeverity.ts';

const listing = (overrides: Partial<StandardsRuleListing> = {}): StandardsRuleListing => ({
	rule: 'multi-export',
	doc: 'lightsout-defaults: code/style-guide/structure/one-export-per-file',
	summary: 'more than one export in a file',
	deterministic: true,
	agent: overrides.deterministic === false,
	severity: StandardsSeverity.Blocking,
	fromConfig: false,
	options: {},
	packages: [''],
	...overrides,
});

const setupPrinter = () => {
	const logged: string[] = [];

	process.stdout.isTTY = false;
	jest.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
		logged.push(String(args[0]));
	});

	return { logged };
};

const cellsOf = ({ logged }: { logged: string[] }) =>
	logged
		.filter((line) => line.startsWith('│'))
		.map((line) =>
			line
				.split('│')
				.slice(1, -1)
				.map((cell) => cell.trim()),
		);

describe('printStandardsRuleList', () => {
	test('each rule gets its state, its checker and the doc it enforces, with its summary beneath', () => {
		const { logged } = setupPrinter();

		printStandardsRuleList({ rules: [listing()] });

		expect(cellsOf({ logged })).toStrictEqual([
			['rule', 'state', 'check', 'standards doc', 'applies to'],
			['multi-export', 'blocking', 'deterministic', 'lightsout-defaults: code/style-guide/structure/one-export-per-file', 'repo root (outside packages)'],
			['more than one export in a file', '', '', '', ''],
			['1 rule(s)', '1 blocking', '0 advisory, 0 off', '1 deterministic, 0 agent', ''],
		]);
	});

	test('a rule no check covers says so on its own row', () => {
		const { logged } = setupPrinter();

		printStandardsRuleList({ rules: [listing({ rule: 'premature-abstraction', summary: 'abstracting before the third use', deterministic: false })] });

		// real policy nothing mechanical will ever catch — a ledger that hid it
		// would read as though every listed rule were enforced
		expect(cellsOf({ logged })[1]?.[2]).toBe('agent');
	});

	test('a rule whose check covers only part of it names both, and counts under both', () => {
		const { logged } = setupPrinter();

		printStandardsRuleList({ rules: [listing({ rule: 'shared-code', agent: true }), listing({ rule: 'multi-export' })] });

		const cells = cellsOf({ logged });

		expect(cells[1]?.[2]).toBe('deterministic and agent');
		expect(cells.at(-1)?.[3]).toBe('2 deterministic, 1 agent');
	});

	test('a row the repo configured is marked, so policy reads apart from default', () => {
		const { logged } = setupPrinter();

		printStandardsRuleList({ rules: [listing({ severity: StandardsSeverity.Off, fromConfig: true })] });

		// "this is our policy" and "this is the default" are different answers
		expect(cellsOf({ logged })[1]?.[1]).toBe('off (config)');
	});

	test("a rule's live numbers ride along with its summary", () => {
		const { logged } = setupPrinter();

		printStandardsRuleList({
			rules: [listing({ rule: 'duplicate-code-block', summary: 'the same block of code written out in two or more files', options: { minTokens: 90 } })],
		});

		// a retuned knob is visible without opening the config
		expect(cellsOf({ logged })[2]?.[0]).toBe('the same block of code written out in two or more files — minTokens 90');
	});

	test("prints a rule's resolved options beside its summary, and the summary alone when it has none", () => {
		const { logged } = setupPrinter();

		printStandardsRuleList({
			rules: [
				listing({ rule: 'duplicate-code-block', summary: 'the same block of code written out in two or more files', options: { minTokens: 90 } }),
				listing({ rule: 'multi-export', summary: 'more than one export in a file', options: {} }),
			],
		});

		expect(cellsOf({ logged }).slice(1, 5)).toStrictEqual([
			[
				'duplicate-code-block',
				'blocking',
				'deterministic',
				'lightsout-defaults: code/style-guide/structure/one-export-per-file',
				'repo root (outside packages)',
			],
			['the same block of code written out in two or more files — minTokens 90', '', '', '', ''],
			['multi-export', 'blocking', 'deterministic', 'lightsout-defaults: code/style-guide/structure/one-export-per-file', 'repo root (outside packages)'],
			['more than one export in a file', '', '', '', ''],
		]);
	});

	test('the totals line counts each state and both kinds of rule, including the rules that run at none', () => {
		const { logged } = setupPrinter();

		printStandardsRuleList({
			rules: [
				listing(),
				listing({ rule: 'duplicate-code-block', severity: StandardsSeverity.Advisory }),
				listing({ rule: 'filename-mismatch', severity: StandardsSeverity.Advisory }),
				listing({ rule: 'folder-size', severity: StandardsSeverity.Off }),
				listing({ rule: 'premature-abstraction', severity: StandardsSeverity.Advisory, deterministic: false }),
			],
		});

		expect(cellsOf({ logged }).at(-1)).toStrictEqual(['5 rule(s)', '1 blocking', '3 advisory, 1 off', '4 deterministic, 1 agent', '']);
	});

	test('a ledger holding no rules at all still prints its headings and a totals row of zeroes', () => {
		const { logged } = setupPrinter();

		printStandardsRuleList({ rules: [] });

		// a package that states no rules is an empty ledger, not a broken one
		expect(cellsOf({ logged })).toStrictEqual([
			['rule', 'state', 'check', 'standards doc', 'applies to'],
			['0 rule(s)', '0 blocking', '0 advisory, 0 off', '0 deterministic, 0 agent', ''],
		]);
	});

	test('prints an applies-to column naming the packages each row covers', () => {
		const { logged } = setupPrinter();

		printStandardsRuleList({
			rules: [
				listing({ rule: 'lightsout/multi-export', packages: ['', 'engine'] }),
				listing({ rule: 'lightsout/multi-export', severity: StandardsSeverity.Advisory, packages: ['web-app'] }),
				listing({ rule: 'lightsout/folder-size', packages: [''] }),
			],
		});

		const cells = cellsOf({ logged });
		const column = cells[0]?.indexOf('applies to') ?? -1;

		expect({ column: column >= 0, appliesTo: [cells[1]?.[column], cells[3]?.[column], cells[5]?.[column]] }).toStrictEqual({
			column: true,
			appliesTo: [describePackageSet({ packages: ['', 'engine'] }), describePackageSet({ packages: ['web-app'] }), describePackageSet({ packages: [''] })],
		});
	});

	test('counts distinct rule names in the totals when a rule has several listings', () => {
		const { logged } = setupPrinter();

		printStandardsRuleList({
			rules: [
				listing({ rule: 'a', severity: StandardsSeverity.Blocking, packages: ['', 'engine'] }),
				listing({ rule: 'a', severity: StandardsSeverity.Advisory, packages: ['web-app'] }),
				listing({ rule: 'b', severity: StandardsSeverity.Advisory, packages: ['', 'engine', 'web-app'] }),
			],
		});

		// three listings of two rules — the ledger counts rules, not rows
		const totals = cellsOf({ logged })
			.at(-1)
			?.filter((cell) => cell !== '');

		expect(totals).toStrictEqual(['2 rule(s)', '1 blocking', '2 advisory, 0 off', '2 deterministic, 0 agent']);
	});
});
