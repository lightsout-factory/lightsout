import { describe, expect, test } from '@jest/globals';
import { setupFileListInput } from '@lightsout/standards-testkit';
import { check } from './check.ts';

const runCheck = async ({ files, tests = [], cap }: { files: string[]; tests?: string[]; cap: number }) =>
	check.run({ inputs: { 'file-list': setupFileListInput({ files, tests }) }, options: { cap } });

/** `count` files sitting directly in `folder`, named so no two collide. */
const setupFiles = ({ folder, count }: { folder: string; count: number }): string[] =>
	Array.from({ length: count }, (_, index) => `${folder}/formatRate${index}.ts`);

describe('folder-size check', () => {
	test('reports a subject folder in a common/ that holds no more files than the cap, and leaves a banned name to the folder-name rule', async () => {
		const findings = await runCheck({
			files: [
				'src/common/utils/formatRate.ts',
				'src/common/formatting/padCell.ts',
				'src/common/formatting/trimCell.ts',
				'src/common/readRate.ts',
				'src/common/types/Rate.ts',
			],
			cap: 4,
		});

		expect(findings).toStrictEqual([
			{
				siteKey: 'folder-size:src/common/formatting',
				files: [{ path: 'src/common/formatting' }],
				detail: "folder 'formatting' groups files in a folder that holds 3 (cap 4)",
				guidance: 'Move its files up beside the others. A `common/` or a module folder is grouped by subject only once it holds more files than the cap.',
			},
		]);
	});

	test('reports a subject folder in a module folder that holds no more files than the cap', async () => {
		const findings = await runCheck({
			files: ['src/commandCatalog/commandCatalog.ts', 'src/commandCatalog/planEntry.ts', 'src/commandCatalog/standards/checkEntry.ts'],
			cap: 4,
		});

		expect(findings.map(({ siteKey, detail }) => ({ siteKey, detail }))).toStrictEqual([
			{ siteKey: 'folder-size:src/commandCatalog/standards', detail: "folder 'standards' groups files in a folder that holds 3 (cap 4)" },
		]);
	});

	test('accepts subject folders once the common/ holds more files than the cap', async () => {
		const findings = await runCheck({
			files: [...setupFiles({ folder: 'src/common/formatting', count: 3 }), ...setupFiles({ folder: 'src/common/parsing', count: 2 })],
			cap: 4,
		});

		expect(findings).toStrictEqual([]);
	});

	test('accepts subject folders once the module folder holds more files than the cap', async () => {
		const findings = await runCheck({
			files: [
				'src/commandCatalog/commandCatalog.ts',
				...setupFiles({ folder: 'src/commandCatalog/standards', count: 2 }),
				...setupFiles({ folder: 'src/commandCatalog/planning', count: 2 }),
			],
			cap: 4,
		});

		expect(findings).toStrictEqual([]);
	});

	test('accepts a module folder in a small common/, and counts it as the one function it is', async () => {
		const findings = await runCheck({
			files: ['src/common/formatRate/formatRate.ts', 'src/common/formatRate/roundRate.ts', 'src/common/formatting/padCell.ts'],
			cap: 2,
		});

		// one module folder plus one file in formatting/ is two, which is not past the cap
		expect(findings.map((finding) => finding.siteKey)).toStrictEqual(['folder-size:src/common/formatting']);
	});

	test('accepts a common/ and a nested module folder inside a small module folder, since neither groups by subject', async () => {
		const findings = await runCheck({
			files: [
				'src/chargeCustomer/chargeCustomer.ts',
				'src/chargeCustomer/common/roundCents.ts',
				'src/chargeCustomer/common/types/Charge.ts',
				'src/chargeCustomer/buildReceipt/buildReceipt.ts',
				'src/chargeCustomer/buildReceipt/formatLine.ts',
			],
			cap: 20,
		});

		expect(findings).toStrictEqual([]);
	});

	test('judges each common/ on its own count', async () => {
		const findings = await runCheck({
			files: [
				...setupFiles({ folder: 'src/common/formatting', count: 3 }),
				...setupFiles({ folder: 'src/common/parsing', count: 2 }),
				'src/billing/common/formatting/padCell.ts',
			],
			cap: 4,
		});

		expect(findings.map((finding) => finding.siteKey)).toStrictEqual(['folder-size:src/billing/common/formatting']);
	});

	test('leaves a subject folder inside a subject folder alone, since only a common/ and a module folder wait for the cap', async () => {
		const findings = await runCheck({ files: ['src/billing/invoices/sendInvoice.ts', 'src/billing/chargeCustomer.ts'], cap: 20 });

		expect(findings).toStrictEqual([]);
	});

	test('leaves a test file and an index file out of the count', async () => {
		const findings = await runCheck({
			files: ['src/common/formatting/padCell.ts', 'src/common/formatting/padCell.unit.test.ts', 'src/common/formatting/index.ts', 'src/common/readRate.ts'],
			tests: ['src/common/formatting/padCell.unit.test.ts'],
			cap: 2,
		});

		expect(findings.map(({ detail }) => detail)).toStrictEqual(["folder 'formatting' groups files in a folder that holds 2 (cap 2)"]);
	});
});
