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

const formatMoney = 'src/billing/common/formatMoney.ts';
const roundCents = 'src/common/roundCents.ts';
const sharedHome = ({ home }: { home: string }) =>
	`Move it to the common/ of '${home}', the lowest folder that holds every file using it, and update the imports.`;

describe('file-placement check', () => {
	test('asks for the import graph, since placement is decided by who imports a file', () => {
		expect(check.inputKinds).toStrictEqual(['import-graph']);
	});

	test('reports a file in a common/ that a file outside the folder it serves imports: it sits too low', async () => {
		const inputs = setupImports({
			imports: [
				['src/billing/chargeCustomer.ts', formatMoney],
				['src/invoices/sendInvoice.ts', formatMoney],
			],
		});

		const findings = await check.run({ inputs, options: {} });

		expect(findings).toStrictEqual([
			{
				siteKey: `file-placement:${formatMoney}`,
				files: [{ path: formatMoney }],
				detail: "sits too low: 'src/invoices/sendInvoice.ts' uses it from outside 'src/billing', and the lowest folder holding every user is 'src'",
				guidance: sharedHome({ home: 'src' }),
			},
		]);
	});

	test('reports a file in a common/ whose every user sits under one child of the folder it serves: it sits too high', async () => {
		const inputs = setupImports({
			imports: [
				['src/billing/chargeCustomer.ts', roundCents],
				['src/billing/refundCustomer.ts', roundCents],
			],
		});

		const findings = await check.run({ inputs, options: {} });

		expect(findings).toStrictEqual([
			{
				siteKey: `file-placement:${roundCents}`,
				files: [{ path: roundCents }],
				detail: "sits too high: every user ('src/billing/chargeCustomer.ts', 'src/billing/refundCustomer.ts') is under 'src/billing'",
				guidance: sharedHome({ home: 'src/billing' }),
			},
		]);
	});

	test('accepts a file whose users sit in two children of the folder its common/ serves', async () => {
		const inputs = setupImports({
			imports: [
				['src/billing/chargeCustomer.ts', 'src/common/formatMoney.ts'],
				['src/invoices/sendInvoice.ts', 'src/common/formatMoney.ts'],
				['src/billing/chargeCustomer.ts', 'src/billing/common/types/Charge.ts'],
				['src/billing/refunds/refundCustomer.ts', 'src/billing/common/types/Charge.ts'],
			],
		});

		const findings = await check.run({ inputs, options: {} });

		expect(findings).toStrictEqual([]);
	});

	test('reports a file in a common/ that one file uses, since nothing shares it', async () => {
		const inputs = setupImports({ imports: [['src/billing/chargeCustomer.ts', 'src/billing/common/roundCents.ts']] });

		const findings = await check.run({ inputs, options: {} });

		expect(findings).toStrictEqual([
			{
				siteKey: 'file-placement:src/billing/common/roundCents.ts',
				files: [{ path: 'src/billing/common/roundCents.ts' }],
				detail: "only 'src/billing/chargeCustomer.ts' uses it",
				guidance: "Move it beside 'src/billing/chargeCustomer.ts', inside that file's module folder, and update the imports.",
			},
		]);
	});

	test('accepts a file beside the main file that alone uses it, as a file or as a module folder of its own', async () => {
		const inputs = setupImports({
			imports: [
				['src/billing/chargeCustomer/chargeCustomer.ts', 'src/billing/chargeCustomer/buildReceipt.ts'],
				['src/billing/chargeCustomer/chargeCustomer.ts', 'src/billing/chargeCustomer/applyTax/applyTax.ts'],
				['src/invoices/sendInvoice.ts', 'src/billing/chargeCustomer/chargeCustomer.ts'],
			],
		});

		const findings = await check.run({ inputs, options: {} });

		expect(findings).toStrictEqual([]);
	});

	test.each([
		{ shape: 'a neighbour that is not a main file', importer: 'src/billing/chargeCustomer.ts', file: 'src/billing/buildReceipt.ts' },
		{ shape: 'a file outside the module folder', importer: 'src/billing/refundCustomer.ts', file: 'src/billing/chargeCustomer/buildReceipt.ts' },
		{ shape: 'a sibling inside the module folder', importer: 'src/billing/chargeCustomer/applyTax.ts', file: 'src/billing/chargeCustomer/readRate.ts' },
	])('reports a file whose one user is $shape', async ({ importer, file }) => {
		const inputs = setupImports({
			imports: [
				[importer, file],
				['src/billing/chargeCustomer/chargeCustomer.ts', 'src/billing/chargeCustomer/applyTax.ts'],
			],
		});

		const findings = await check.run({ inputs, options: {} });

		expect(findings.filter((finding) => finding.files[0]?.path === file).map(({ detail, guidance }) => ({ detail, guidance }))).toStrictEqual([
			{ detail: `only '${importer}' uses it`, guidance: `Move it beside '${importer}', inside that file's module folder, and update the imports.` },
		]);
	});

	test('accepts a top-level file of a subject folder that a file outside the folder uses: it is public', async () => {
		const inputs = setupImports({
			imports: [
				['src/invoices/sendInvoice.ts', 'src/billing/chargeCustomer.ts'],
				['src/billing/refundCustomer.ts', 'src/billing/chargeCustomer.ts'],
				['src/invoices/sendInvoice.ts', 'src/billing/refundCustomer.ts'],
			],
		});

		const findings = await check.run({ inputs, options: {} });

		expect(findings).toStrictEqual([]);
	});

	test('accepts a file the package’s index file exports, whoever else uses it', async () => {
		const inputs = setupImports({
			imports: [
				['src/index.ts', 'src/chargeCustomer.ts'],
				['src/billing/refundCustomer.ts', 'src/chargeCustomer.ts'],
				['src/index.ts', 'src/billing/refundCustomer.ts'],
			],
		});

		const findings = await check.run({ inputs, options: {} });

		expect(findings).toStrictEqual([]);
	});

	test('reports a top-level file of a subject folder that only files inside the folder share', async () => {
		const inputs = setupImports({
			imports: [
				['src/billing/chargeCustomer.ts', 'src/billing/taxRate.ts'],
				['src/billing/refunds/refundCustomer.ts', 'src/billing/taxRate.ts'],
				['src/invoices/sendInvoice.ts', 'src/billing/chargeCustomer.ts'],
				['src/invoices/sendInvoice.ts', 'src/billing/refunds/refundCustomer.ts'],
			],
		});

		const findings = await check.run({ inputs, options: {} });

		expect(findings).toStrictEqual([
			{
				siteKey: 'file-placement:src/billing/taxRate.ts',
				files: [{ path: 'src/billing/taxRate.ts' }],
				detail: "is shared by 'src/billing/chargeCustomer.ts', 'src/billing/refunds/refundCustomer.ts' and sits outside a common/",
				guidance: sharedHome({ home: 'src/billing' }),
			},
		]);
	});

	test('reports a file inside a module folder that a file outside the folder also uses: only the main file is public', async () => {
		const inputs = setupImports({
			imports: [
				['src/billing/chargeCustomer/chargeCustomer.ts', 'src/billing/chargeCustomer/buildReceipt.ts'],
				['src/invoices/sendInvoice.ts', 'src/billing/chargeCustomer/buildReceipt.ts'],
				['src/invoices/sendInvoice.ts', 'src/billing/chargeCustomer/chargeCustomer.ts'],
			],
		});

		const findings = await check.run({ inputs, options: {} });

		expect(findings.map(({ siteKey, guidance }) => ({ siteKey, guidance }))).toStrictEqual([
			{ siteKey: 'file-placement:src/billing/chargeCustomer/buildReceipt.ts', guidance: sharedHome({ home: 'src' }) },
		]);
	});

	test('leaves a file outside every common/ and outside a package’s src/ alone', async () => {
		const inputs = setupImports({
			imports: [
				['scripts/build.ts', 'scripts/readVersion.ts'],
				['scripts/release.ts', 'scripts/readVersion.ts'],
			],
		});

		const findings = await check.run({ inputs, options: {} });

		expect(findings).toStrictEqual([]);
	});

	test('users directly in a lower common/, or in its types/, place the file in that common/', async () => {
		const inputs = setupImports({
			imports: [
				['src/billing/common/formatRate.ts', roundCents],
				['src/billing/common/types/Rate.ts', roundCents],
			],
		});

		const findings = await check.run({ inputs, options: {} });

		expect(findings.map((finding) => finding.guidance)).toStrictEqual([sharedHome({ home: 'src/billing' })]);
	});

	test('users in two folders of the file’s own common/ are its peers, and it stays where it is', async () => {
		const inputs = setupImports({
			imports: [
				['src/common/formatting/formatMoney.ts', roundCents],
				['src/common/parsing/parseMoney.ts', roundCents],
				['src/common/formatting/formatMoney.ts', 'src/common/formatting/padCell.ts'],
				['src/common/formatting/formatRate.ts', 'src/common/formatting/padCell.ts'],
				['src/billing/chargeCustomer.ts', 'src/common/formatting/formatMoney.ts'],
				['src/invoices/sendInvoice.ts', 'src/common/formatting/formatMoney.ts'],
				['src/billing/chargeCustomer.ts', 'src/common/formatting/formatRate.ts'],
				['src/invoices/sendInvoice.ts', 'src/common/formatting/formatRate.ts'],
				['src/billing/chargeCustomer.ts', 'src/common/parsing/parseMoney.ts'],
				['src/invoices/sendInvoice.ts', 'src/common/parsing/parseMoney.ts'],
				['src/index.ts', 'src/billing/chargeCustomer.ts'],
				['src/index.ts', 'src/invoices/sendInvoice.ts'],
			],
		});

		const findings = await check.run({ inputs, options: {} });

		expect(findings).toStrictEqual([]);
	});

	test('a test is not a user, so a test elsewhere never moves a file', async () => {
		const inputs = setupImports({
			imports: [
				['src/billing/chargeCustomer.ts', formatMoney],
				['src/billing/refundCustomer.ts', formatMoney],
				['tests/formatMoney.unit.test.ts', formatMoney],
			],
		});

		const findings = await check.run({ inputs, options: {} });

		expect(findings).toStrictEqual([]);
	});

	test('an importer in another workspace package is left out of the placement', async () => {
		const inputs = setupImports({
			imports: [
				['packages/engine/src/runs/startRun.ts', 'packages/engine/src/common/types/RunId.ts'],
				['packages/engine/src/plans/readPlan.ts', 'packages/engine/src/common/types/RunId.ts'],
				['packages/web/src/app.ts', 'packages/engine/src/common/types/RunId.ts'],
			],
			dependencies: [
				['.', []],
				['packages/engine', []],
				['packages/web', []],
			],
		});

		const findings = await check.run({ inputs, options: {} });

		// within the engine, two users under two children of src/: placed right
		expect(findings).toStrictEqual([]);
	});

	test('a file nobody imports is left to dead-export', async () => {
		const inputs = setupImports({
			imports: [
				['src/billing/chargeCustomer.ts', formatMoney],
				['src/billing/refundCustomer.ts', formatMoney],
			],
		});
		const withUnused = {
			'import-graph': { ...inputs['import-graph'], referenceFiles: [...inputs['import-graph'].referenceFiles, roundCents], files: [roundCents] },
		};

		const findings = await check.run({ inputs: withUnused, options: {} });

		expect(findings).toStrictEqual([]);
	});

	test('reports a file when only one of its importers is in scope, and nothing when neither is', async () => {
		const imports: Array<[string, string]> = [
			['src/billing/chargeCustomer.ts', formatMoney],
			['src/invoices/sendInvoice.ts', formatMoney],
		];

		const importerInScope = await check.run({ inputs: setupImports({ imports, scope: ['src/invoices/sendInvoice.ts'] }), options: {} });
		const nothingInScope = await check.run({ inputs: setupImports({ imports, scope: ['src/other.ts'] }), options: {} });

		expect(importerInScope.map((finding) => finding.siteKey)).toStrictEqual([`file-placement:${formatMoney}`]);
		expect(nothingInScope).toStrictEqual([]);
	});

	test('answers nothing when its input is missing', async () => {
		const findings = await check.run({ inputs: {}, options: {} });

		expect(findings).toStrictEqual([]);
	});
});
