import { describe, expect, test } from '@jest/globals';
import { setupImportGraphInput, setupOtherKindInput } from '@lightsout/standards-testkit';
import { check } from './check.ts';

/** Each `[from, to]` pair is one import. Every file is in scope unless `scope` narrows the run. */
const setupImports = ({ imports, scope, standardsLibraries = [] }: { imports: Array<[string, string]>; scope?: string[]; standardsLibraries?: string[] }) => {
	const edges = imports.map(([from, to]) => ({ from, to }));
	const paths = [...new Set(imports.flat())];

	return setupImportGraphInput({ edges, source: scope ?? paths, files: scope ?? paths, referenceFiles: paths, standardsLibraries });
};

const cycleGuidance = 'Move the piece these files share, usually a type, into a file each of them imports, so that the imports run one way.';

describe('circular-dependencies check', () => {
	test('reports two files that import each other, once', async () => {
		const input = setupImports({
			imports: [
				['src/orders/getOrderTotal.ts', 'src/customers/getCustomerTier.ts'],
				['src/customers/getCustomerTier.ts', 'src/orders/getOrderTotal.ts'],
			],
		});

		const findings = await check.run({ input, options: {} });

		expect(findings).toStrictEqual([
			{
				siteKey: 'circular-dependencies:src/customers/getCustomerTier.ts|src/orders/getOrderTotal.ts',
				files: [{ path: 'src/customers/getCustomerTier.ts' }, { path: 'src/orders/getOrderTotal.ts' }],
				detail: "'src/customers/getCustomerTier.ts' imports 'src/orders/getOrderTotal.ts', which imports 'src/customers/getCustomerTier.ts'",
				guidance: cycleGuidance,
			},
		]);
	});

	test('reports a longer cycle with every file in it, in the order the imports run', async () => {
		const input = setupImports({
			imports: [
				['src/c.ts', 'src/a.ts'],
				['src/a.ts', 'src/b.ts'],
				['src/b.ts', 'src/c.ts'],
			],
		});

		const findings = await check.run({ input, options: {} });

		expect(findings).toStrictEqual([
			{
				siteKey: 'circular-dependencies:src/a.ts|src/b.ts|src/c.ts',
				files: [{ path: 'src/a.ts' }, { path: 'src/b.ts' }, { path: 'src/c.ts' }],
				detail: "'src/a.ts' imports 'src/b.ts', which imports 'src/c.ts', which imports 'src/a.ts'",
				guidance: cycleGuidance,
			},
		]);
	});

	test('reports only the shortest cycle of a group that holds several, and says how many files the group has', async () => {
		const input = setupImports({
			imports: [
				['src/a.ts', 'src/b.ts'],
				['src/b.ts', 'src/c.ts'],
				['src/c.ts', 'src/d.ts'],
				['src/d.ts', 'src/a.ts'],
				['src/d.ts', 'src/c.ts'],
			],
		});

		const findings = await check.run({ input, options: {} });

		expect(findings).toStrictEqual([
			{
				siteKey: 'circular-dependencies:src/c.ts|src/d.ts',
				files: [{ path: 'src/c.ts' }, { path: 'src/d.ts' }],
				detail: "'src/c.ts' imports 'src/d.ts', which imports 'src/c.ts' — the shortest cycle among 4 files that import each other",
				guidance: cycleGuidance,
			},
		]);
	});

	test('reports each group of files on its own, however the two groups are joined', async () => {
		const input = setupImports({
			imports: [
				['src/a.ts', 'src/b.ts'],
				['src/b.ts', 'src/a.ts'],
				['src/b.ts', 'src/y.ts'],
				['src/y.ts', 'src/z.ts'],
				['src/z.ts', 'src/y.ts'],
			],
		});

		const findings = await check.run({ input, options: {} });

		expect(findings.map(({ siteKey }) => siteKey).sort()).toStrictEqual(['circular-dependencies:src/a.ts|src/b.ts', 'circular-dependencies:src/y.ts|src/z.ts']);
	});

	test('gives a cycle the same finding whichever order its imports arrive in', async () => {
		const imports: Array<[string, string]> = [
			['src/a.ts', 'src/b.ts'],
			['src/b.ts', 'src/c.ts'],
			['src/c.ts', 'src/a.ts'],
			['src/c.ts', 'src/d.ts'],
			['src/d.ts', 'src/b.ts'],
		];

		const forward = await check.run({ input: setupImports({ imports }), options: {} });
		const backward = await check.run({ input: setupImports({ imports: [...imports].reverse() }), options: {} });

		expect(backward).toStrictEqual(forward);
		expect(forward.map(({ siteKey }) => siteKey)).toStrictEqual(['circular-dependencies:src/a.ts|src/b.ts|src/c.ts']);
	});

	test('counts one import written twice as one', async () => {
		const input = setupImports({
			imports: [
				['src/a.ts', 'src/b.ts'],
				['src/a.ts', 'src/b.ts'],
				['src/b.ts', 'src/a.ts'],
			],
		});

		const findings = await check.run({ input, options: {} });

		expect(findings.map(({ siteKey }) => siteKey)).toStrictEqual(['circular-dependencies:src/a.ts|src/b.ts']);
	});

	test('accepts files that share a third file, since the imports run one way', async () => {
		const input = setupImports({
			imports: [
				['src/orders/getOrderTotal.ts', 'src/common/types/CustomerTier.ts'],
				['src/customers/getCustomerTier.ts', 'src/common/types/CustomerTier.ts'],
				['src/orders/getOrderTotal.ts', 'src/customers/getCustomerTier.ts'],
			],
		});

		const findings = await check.run({ input, options: {} });

		expect(findings).toStrictEqual([]);
	});

	test('accepts a cycle that runs through a test file, since the rule is about source', async () => {
		const input = setupImports({
			imports: [
				['src/getLabel.ts', 'src/getLabel.unit.test.ts'],
				['src/getLabel.unit.test.ts', 'src/getLabel.ts'],
				['tests/helpers/setupLabel.ts', 'tests/helpers/setupName.ts'],
				['tests/helpers/setupName.ts', 'tests/helpers/setupLabel.ts'],
			],
		});

		const findings = await check.run({ input, options: {} });

		expect(findings).toStrictEqual([]);
	});

	test('reports a cycle between rule files under a standards library’s `tests/` folder, which holds rules and not tests', async () => {
		const input = setupImports({
			imports: [
				['standards/rules/tests/a/check.ts', 'standards/rules/tests/b/check.ts'],
				['standards/rules/tests/b/check.ts', 'standards/rules/tests/a/check.ts'],
			],
			standardsLibraries: ['standards'],
		});

		const findings = await check.run({ input, options: {} });

		expect(findings.map(({ siteKey }) => siteKey)).toStrictEqual(['circular-dependencies:standards/rules/tests/a/check.ts|standards/rules/tests/b/check.ts']);
	});

	test('reports a cycle when one of its files is in scope, and says nothing of a cycle wholly outside it', async () => {
		const imports: Array<[string, string]> = [
			['src/a.ts', 'src/b.ts'],
			['src/b.ts', 'src/a.ts'],
			['src/y.ts', 'src/z.ts'],
			['src/z.ts', 'src/y.ts'],
		];

		const findings = await check.run({ input: setupImports({ imports, scope: ['src/b.ts'] }), options: {} });

		expect(findings.map(({ siteKey }) => siteKey)).toStrictEqual(['circular-dependencies:src/a.ts|src/b.ts']);
	});

	test('follows an import chain far deeper than the call stack', async () => {
		const depth = 50_000;
		const imports = Array.from({ length: depth }, (_, index): [string, string] => [`src/step${index}.ts`, `src/step${index + 1}.ts`]);

		const findings = await check.run({ input: setupImports({ imports: [...imports, [`src/step${depth}.ts`, `src/step${depth - 1}.ts`]] }), options: {} });

		expect(findings.map(({ siteKey }) => siteKey)).toStrictEqual([`circular-dependencies:src/step${depth - 1}.ts|src/step${depth}.ts`]);
	});

	test('answers nothing for an input of another kind', async () => {
		const findings = await check.run({ input: setupOtherKindInput(), options: {} });

		expect(findings).toStrictEqual([]);
	});
});
