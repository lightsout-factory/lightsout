import { describe, expect, test } from '@jest/globals';
import { setupOtherKindInput, setupSyntaxTreeInput } from '@lightsout/standards-testkit';
import { check } from './check.ts';

const guidance = "Delete the doc comment: the function's `@param` tags say what each argument is for.";

describe('params-interface-docs check', () => {
	test('asks for parsed trees, since only the tree says which comment sits on the interface', () => {
		expect(check.inputKind).toBe('syntax-tree');
	});

	test('reports a doc comment on a Params interface and the line the interface starts on', async () => {
		const input = setupSyntaxTreeInput({
			sources: [['src/billing/chargeInvoice.ts', '/** The arguments. */\ninterface Params {\n\tinvoiceId: string;\n}\n']],
		});

		const findings = await check.run({ input, settings: {} });

		expect(findings).toStrictEqual([
			{
				siteKey: 'params-interface-docs:src/billing/chargeInvoice.ts',
				files: [{ path: 'src/billing/chargeInvoice.ts' }],
				detail: 'a doc comment on the `Params` interface at line 2',
				guidance,
			},
		]);
	});

	test('reports a doc comment above an exported or generic Params interface', async () => {
		const input = setupSyntaxTreeInput({
			sources: [
				['src/billing/chargeInvoice.ts', '/** The arguments. */\nexport interface Params {\n\tinvoiceId: string;\n}\n'],
				['src/common/utils/retry.ts', '/**\n * The arguments.\n */\ninterface Params<T> {\n\tfn: () => T;\n}\n'],
			],
		});

		const findings = await check.run({ input, settings: {} });

		expect(findings.map(({ detail }) => detail)).toStrictEqual([
			'a doc comment on the `Params` interface at line 2',
			'a doc comment on the `Params` interface at line 4',
		]);
	});

	test('leaves a Params interface whose only comments sit on its properties', async () => {
		const input = setupSyntaxTreeInput({
			sources: [['src/billing/chargeInvoice.ts', 'interface Params {\n\t/** Name printed on the receipt. */\n\tpayerName: string;\n}\n']],
		});

		const findings = await check.run({ input, settings: {} });

		expect(findings).toStrictEqual([]);
	});

	test('leaves a line comment above a Params interface, which is not a doc comment', async () => {
		const input = setupSyntaxTreeInput({
			sources: [
				['src/billing/chargeInvoice.ts', '// biome-ignore lint/style/useNamingConvention: vendor field names\ninterface Params {\n\tinvoice_id: string;\n}\n'],
			],
		});

		const findings = await check.run({ input, settings: {} });

		expect(findings).toStrictEqual([]);
	});

	test('leaves a documented interface with any other name', async () => {
		const input = setupSyntaxTreeInput({
			sources: [['src/billing/Invoice.ts', '/** An invoice as the billing provider returns it. */\nexport interface Invoice {\n\tid: string;\n}\n']],
		});

		const findings = await check.run({ input, settings: {} });

		expect(findings).toStrictEqual([]);
	});

	test('reports nothing for an input of any other kind rather than refusing', async () => {
		const findings = await check.run({ input: setupOtherKindInput(), settings: {} });

		expect(findings).toStrictEqual([]);
	});
});
