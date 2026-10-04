import { describe, expect, test } from '@jest/globals';
import { setupFileListInput } from '@lightsout/standards-testkit';
import { check } from './check.ts';

describe('duplicate-export-name check', () => {
	test('asks for the file list alone, since a path already carries the export name', () => {
		expect(check.inputKinds).toStrictEqual(['file-list']);
	});

	test('reports one name declared in two places, naming both files', async () => {
		const input = setupFileListInput({
			source: ['src/billing/formatAmount.ts', 'src/invoices/formatAmount.ts', 'src/invoices/getInvoiceLabel.ts'],
		});

		const findings = await check.run({ inputs: { 'file-list': input }, options: {} });

		expect(findings).toStrictEqual([
			{
				siteKey: 'duplicate-export-name:src/billing/formatAmount.ts|src/invoices/formatAmount.ts',
				files: [{ path: 'src/billing/formatAmount.ts' }, { path: 'src/invoices/formatAmount.ts' }],
				detail: "'formatAmount' is declared in 2 places",
				guidance: 'Keep one and share it, or rename the one that is a different thing.',
			},
		]);
	});

	test('a name in three places is reported once, with every file it occupies', async () => {
		const input = setupFileListInput({
			source: ['src/invoices/formatAmount.ts', 'src/billing/formatAmount.ts', 'src/reports/formatAmount.ts'],
		});

		const findings = await check.run({ inputs: { 'file-list': input }, options: {} });

		expect(findings).toStrictEqual([
			{
				siteKey: 'duplicate-export-name:src/billing/formatAmount.ts|src/invoices/formatAmount.ts|src/reports/formatAmount.ts',
				files: [{ path: 'src/invoices/formatAmount.ts' }, { path: 'src/billing/formatAmount.ts' }, { path: 'src/reports/formatAmount.ts' }],
				detail: "'formatAmount' is declared in 3 places",
				guidance: 'Keep one and share it, or rename the one that is a different thing.',
			},
		]);
	});

	test('a second duplicated name earns a finding of its own, in the order the names first appear', async () => {
		const input = setupFileListInput({
			source: ['src/billing/formatAmount.ts', 'src/invoices/formatAmount.ts', 'src/billing/getTotal.ts', 'src/reports/getTotal.ts'],
		});

		const findings = await check.run({ inputs: { 'file-list': input }, options: {} });

		expect(findings).toStrictEqual([
			{
				siteKey: 'duplicate-export-name:src/billing/formatAmount.ts|src/invoices/formatAmount.ts',
				files: [{ path: 'src/billing/formatAmount.ts' }, { path: 'src/invoices/formatAmount.ts' }],
				detail: "'formatAmount' is declared in 2 places",
				guidance: 'Keep one and share it, or rename the one that is a different thing.',
			},
			{
				siteKey: 'duplicate-export-name:src/billing/getTotal.ts|src/reports/getTotal.ts',
				files: [{ path: 'src/billing/getTotal.ts' }, { path: 'src/reports/getTotal.ts' }],
				detail: "'getTotal' is declared in 2 places",
				guidance: 'Keep one and share it, or rename the one that is a different thing.',
			},
		]);
	});

	test('the same name under different file extensions is still one export name declared twice over', async () => {
		const input = setupFileListInput({
			source: ['src/billing/formatAmount.ts', 'src/invoices/formatAmount.tsx', 'src/reports/formatAmount.mts'],
		});

		const findings = await check.run({ inputs: { 'file-list': input }, options: {} });

		expect(findings).toStrictEqual([
			{
				siteKey: 'duplicate-export-name:src/billing/formatAmount.ts|src/invoices/formatAmount.tsx|src/reports/formatAmount.mts',
				files: [{ path: 'src/billing/formatAmount.ts' }, { path: 'src/invoices/formatAmount.tsx' }, { path: 'src/reports/formatAmount.mts' }],
				detail: "'formatAmount' is declared in 3 places",
				guidance: 'Keep one and share it, or rename the one that is a different thing.',
			},
		]);
	});

	test('compares names within one package, so two packages may each declare the same name', async () => {
		const input = setupFileListInput({
			files: ['packages/api/src/formatRate.ts', 'packages/web/src/formatRate.ts', 'packages/web/src/billing/formatRate.ts'],
			dependencies: [
				['.', []],
				['packages/api', []],
				['packages/web', []],
			],
		});

		const findings = await check.run({ inputs: { 'file-list': input }, options: {} });

		expect(findings.map(({ files }) => files)).toStrictEqual([
			[{ path: 'packages/web/src/formatRate.ts' }, { path: 'packages/web/src/billing/formatRate.ts' }],
		]);
	});

	test('one home per name earns no finding', async () => {
		const input = setupFileListInput({ source: ['src/common/utils/formatAmount.ts', 'src/invoices/getInvoiceLabel.ts'] });

		const findings = await check.run({ inputs: { 'file-list': input }, options: {} });

		expect(findings).toStrictEqual([]);
	});

	test('an index in every folder is the module convention, not a duplicated name', async () => {
		const input = setupFileListInput({ source: ['src/billing/index.ts', 'src/invoices/index.ts', 'src/invoices/getInvoiceLabel.ts'] });

		const findings = await check.run({ inputs: { 'file-list': input }, options: {} });

		expect(findings).toStrictEqual([]);
	});

	test('an index is passed over whatever its extension, without hiding a real duplicate beside it', async () => {
		const input = setupFileListInput({
			source: ['src/billing/index.ts', 'src/invoices/index.tsx', 'src/billing/formatAmount.ts', 'src/invoices/formatAmount.ts'],
		});

		const findings = await check.run({ inputs: { 'file-list': input }, options: {} });

		expect(findings).toStrictEqual([
			{
				siteKey: 'duplicate-export-name:src/billing/formatAmount.ts|src/invoices/formatAmount.ts',
				files: [{ path: 'src/billing/formatAmount.ts' }, { path: 'src/invoices/formatAmount.ts' }],
				detail: "'formatAmount' is declared in 2 places",
				guidance: 'Keep one and share it, or rename the one that is a different thing.',
			},
		]);
	});

	test('two tests named after the subjects they cover are the convention working', async () => {
		const input = setupFileListInput({
			source: ['src/billing/getTotal.ts', 'src/invoices/getInvoiceTotal.ts'],
			tests: ['src/billing/getTotal.unit.test.ts', 'src/invoices/getTotal.unit.test.ts'],
		});

		const findings = await check.run({ inputs: { 'file-list': input }, options: {} });

		expect(findings).toStrictEqual([]);
	});

	test('a test file sharing a source file name leaves that name one home, not two', async () => {
		const input = setupFileListInput({
			source: ['src/billing/setupCharge.ts', 'src/invoices/getInvoiceLabel.ts'],
			tests: ['tests/helpers/setupCharge.ts'],
		});

		const findings = await check.run({ inputs: { 'file-list': input }, options: {} });

		expect(findings).toStrictEqual([]);
	});

	test('reports nothing when its input is missing rather than refusing', async () => {
		const findings = await check.run({ inputs: {}, options: {} });

		expect(findings).toStrictEqual([]);
	});
});
