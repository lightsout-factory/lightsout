import { describe, expect, test } from '@jest/globals';
import { setupImportGraphInput } from '@lightsout/standards-testkit';
import { check } from './check.ts';

/** Each `[from, to]` pair is one import. Every file is in scope unless `scope` narrows the run. */
const setupImports = ({
	imports,
	scope,
	standardsLibraries = [],
	dependencies = [['.', []]],
}: {
	imports: Array<[string, string]>;
	scope?: string[];
	standardsLibraries?: string[];
	dependencies?: Array<[string, string[]]>;
}) => {
	const edges = imports.map(([from, to]) => ({ from, to }));
	const paths = [...new Set(imports.flat())];

	return {
		'import-graph': setupImportGraphInput({ edges, dependencies, source: scope ?? paths, files: scope ?? paths, referenceFiles: paths, standardsLibraries }),
	};
};

const formatMoney = 'src/billing/common/utils/formatMoney.ts';
const roundCents = 'src/common/utils/roundCents.ts';

describe('shared-code-placement check', () => {
	test('asks for the import graph, since placement is decided by who imports a file', () => {
		expect(check.inputKinds).toStrictEqual(['import-graph']);
	});

	test('reports a file in a common/ that a file outside the folder it serves imports: it sits too low', async () => {
		const inputs = setupImports({
			imports: [
				['src/billing/billing.ts', formatMoney],
				['src/invoices.ts', formatMoney],
			],
		});

		const findings = await check.run({ inputs, options: {} });

		expect(findings).toStrictEqual([
			{
				siteKey: `shared-code-placement:${formatMoney}`,
				files: [{ path: formatMoney }],
				detail: "sits too low: 'src/invoices.ts' uses it from outside 'src/billing', and the lowest folder holding every user is 'src'",
				guidance: "Move it to the common/ of 'src', the lowest folder that holds every file using it, and update the imports.",
			},
		]);
	});

	test('reports a file in a common/ whose every user sits under one child of the folder it serves: it sits too high', async () => {
		const inputs = setupImports({ imports: [['src/billing/billing.ts', roundCents]] });

		const findings = await check.run({ inputs, options: {} });

		expect(findings).toStrictEqual([
			{
				siteKey: `shared-code-placement:${roundCents}`,
				files: [{ path: roundCents }],
				detail: "sits too high: every user ('src/billing/billing.ts') is under 'src/billing'",
				guidance: "Move it to the common/ of 'src/billing', the lowest folder that holds every file using it, and update the imports.",
			},
		]);
	});

	test('accepts a file whose users sit in two children of the folder its common/ serves', async () => {
		const inputs = setupImports({
			imports: [
				['src/billing/billing.ts', 'src/common/utils/formatMoney.ts'],
				['src/invoices/invoices.ts', 'src/common/utils/formatMoney.ts'],
				['src/billing/billing.ts', 'src/billing/common/utils/roundCents.ts'],
				['src/billing/internal/applyDiscount.ts', 'src/billing/common/utils/roundCents.ts'],
			],
		});

		const findings = await check.run({ inputs, options: {} });

		expect(findings).toStrictEqual([]);
	});

	test('a user inside a lower common/ places the file in that common/, not one level above it', async () => {
		const inputs = setupImports({ imports: [['src/billing/common/utils/formatRate.ts', roundCents]] });

		const findings = await check.run({ inputs, options: {} });

		expect(findings.map((finding) => finding.guidance)).toStrictEqual([
			"Move it to the common/ of 'src/billing', the lowest folder that holds every file using it, and update the imports.",
		]);
	});

	test('users in a domain folder of a lower common/ make that folder the home, since it is a folder of its own', async () => {
		const inputs = setupImports({
			imports: [
				['src/cli/common/render/printTable.ts', 'src/cli/common/render/common/utils/padCell.ts'],
				['src/cli/common/render/printList.ts', 'src/cli/common/render/common/utils/padCell.ts'],
				['src/cli/common/render/printTable.ts', 'src/common/utils/formatRate.ts'],
			],
		});

		const findings = await check.run({ inputs, options: {} });

		// padCell sits in the render folder's own common/, which its two users share; formatRate
		// has one user, under render, so its home is the common/ of 'src/cli/common/render'
		expect(findings.map((finding) => finding.detail)).toStrictEqual([
			"sits too high: every user ('src/cli/common/render/printTable.ts') is under 'src/cli/common/render'",
		]);
	});

	test('a helper another helper in the same common/ uses is placed right where it is, whichever folders of that common/ they sit in', async () => {
		const inputs = setupImports({
			imports: [
				['src/common/utils/formatMoney.ts', roundCents],
				['src/common/scope/getReach.ts', 'src/common/scope/getEdited.ts'],
				['src/common/render/printTable.ts', 'src/common/utils/padCell.ts'],
			],
		});

		const findings = await check.run({ inputs, options: {} });

		expect(findings).toStrictEqual([]);
	});

	test('a common/ inside an internal/ serves the folder above the internal/', async () => {
		const inputs = setupImports({
			imports: [
				['src/billing/billing.ts', 'src/billing/internal/common/utils/roundCents.ts'],
				['src/billing/internal/applyDiscount.ts', 'src/billing/internal/common/utils/roundCents.ts'],
			],
		});

		const findings = await check.run({ inputs, options: {} });

		expect(findings).toStrictEqual([]);
	});

	test('a test is not a user, so a test elsewhere never moves a file', async () => {
		const inputs = setupImports({
			imports: [
				['src/billing/billing.ts', formatMoney],
				['tests/formatMoney.unit.test.ts', formatMoney],
			],
		});

		const findings = await check.run({ inputs, options: {} });

		expect(findings).toStrictEqual([]);
	});

	test('an importer in another workspace package is left out of the placement', async () => {
		const inputs = setupImports({
			imports: [
				['packages/engine/src/run.ts', 'packages/engine/src/common/types/RunId.ts'],
				['packages/web/src/app.ts', 'packages/engine/src/common/types/RunId.ts'],
			],
			dependencies: [
				['.', []],
				['packages/engine', []],
				['packages/web', []],
			],
		});

		const findings = await check.run({ inputs, options: {} });

		// within the engine, one user under src/ beside the common/: placed right
		expect(findings).toStrictEqual([]);
	});

	test('a file nobody imports is left to dead-export', async () => {
		const inputs = setupImports({ imports: [['src/billing/billing.ts', 'src/billing/common/utils/other.ts']] });
		const withUnused = {
			'import-graph': { ...inputs['import-graph'], referenceFiles: [...inputs['import-graph'].referenceFiles, roundCents], files: [roundCents] },
		};

		const findings = await check.run({ inputs: withUnused, options: {} });

		expect(findings).toStrictEqual([]);
	});

	test('reports a file when only one of its importers is in scope, and nothing when neither is', async () => {
		const imports: Array<[string, string]> = [
			['src/billing/billing.ts', formatMoney],
			['src/invoices.ts', formatMoney],
		];

		const importerInScope = await check.run({ inputs: setupImports({ imports, scope: ['src/invoices.ts'] }), options: {} });
		const nothingInScope = await check.run({ inputs: setupImports({ imports, scope: ['src/other.ts'] }), options: {} });

		expect(importerInScope.map((finding) => finding.siteKey)).toStrictEqual([`shared-code-placement:${formatMoney}`]);
		expect(nothingInScope).toStrictEqual([]);
	});

	test('answers nothing when its input is missing', async () => {
		const findings = await check.run({ inputs: {}, options: {} });

		expect(findings).toStrictEqual([]);
	});
});
