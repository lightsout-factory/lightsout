import { describe, expect, test } from '@jest/globals';
import { setupSyntaxTreeInput } from '@lightsout/standards-testkit';
import { check } from './check.ts';

/** An arrow on lines 1–6 whose body is two statements and a shorthand return. */
const formatAmountSource = `export const formatAmount = ({ amount, fee }: { amount: number; fee: number }) => {
	const total = amount + fee;
	const doubled = total * total;

	return { total, doubled };
};
`;

/** The same body on lines 1–6 with every identifier renamed. */
const formatTotalSource = `export const formatTotal = ({ price, tax }: { price: number; tax: number }) => {
	const sum = price + tax;
	const scaled = sum * sum;

	return { sum, scaled };
};
`;

/** A body the suite already measures at 32 tokens, so the floor can be probed from either side of it. */
const splitWordsSource = ({ name }: { name: string }) =>
	`export const ${name} = ({ text }: { text: string }): string[] =>\n\ttext\n\t\t.replace(/([a-z0-9])([A-Z])/g, '$1 $2')\n\t\t.split(/[\\s\\-_.]+/)\n\t\t.filter(Boolean)\n\t\t.map((token) => token.toLowerCase());\n`;

/** That 32-token body written twice, as the two sources a floor probe needs. */
const splitWordsPair: Array<[string, string]> = [
	['src/common/naming/getTokens.ts', splitWordsSource({ name: 'getTokens' })],
	['src/common/naming/splitWords.ts', splitWordsSource({ name: 'splitWords' })],
];

describe('duplicate-function-body check', () => {
	test('bodies under the token floor are too small to call duplicates', async () => {
		const input = setupSyntaxTreeInput({
			sources: [
				['src/billing/formatAmount.ts', formatAmountSource],
				['src/invoices/formatTotal.ts', formatTotalSource],
			],
		});

		const findings = await check.run({ inputs: { 'syntax-tree': input }, options: { minBodyTokens: 200 } });

		expect(findings).toStrictEqual([]);
	});

	test('a body exactly at the token floor is still a duplicate — the floor is the smallest size that counts', async () => {
		const input = setupSyntaxTreeInput({ sources: splitWordsPair });

		const findings = await check.run({ inputs: { 'syntax-tree': input }, options: { minBodyTokens: 32 } });

		expect(findings.map(({ detail }) => detail)).toStrictEqual(["'getTokens', 'splitWords' (32 tokens) have the same body under different names"]);
	});

	test('a body one token short of the floor is silent', async () => {
		const input = setupSyntaxTreeInput({ sources: splitWordsPair });

		const findings = await check.run({ inputs: { 'syntax-tree': input }, options: { minBodyTokens: 33 } });

		expect(findings).toStrictEqual([]);
	});

	test('reads its body-size threshold from the minBodyTokens option', async () => {
		const input = setupSyntaxTreeInput({
			sources: [
				['src/billing/formatAmount.ts', formatAmountSource],
				['src/invoices/formatTotal.ts', formatTotalSource],
			],
		});

		const [lowFloor, highFloor] = await Promise.all([
			check.run({ inputs: { 'syntax-tree': input }, options: { minBodyTokens: 5 } }),
			check.run({ inputs: { 'syntax-tree': input }, options: { minBodyTokens: 500 } }),
		]);

		expect({ lowFloor: lowFloor.map(({ siteKey }) => siteKey), highFloor }).toStrictEqual({
			lowFloor: ['duplicate-function-body:src/billing/formatAmount.ts|src/invoices/formatTotal.ts'],
			highFloor: [],
		});
	});
});
