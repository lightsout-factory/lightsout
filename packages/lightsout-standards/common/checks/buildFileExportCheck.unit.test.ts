import { describe, expect, test } from '@jest/globals';
import { setupFileTextInput } from '@lightsout/standards-testkit';
import { buildFileExportCheck } from './buildFileExportCheck.ts';

const check = buildFileExportCheck({
	rule: 'demo-exports',
	// Flags any file declaring more than one export — judgment enough to see the shared half work.
	detail: ({ exports }) => (exports.length > 1 ? `${exports.length} exports` : undefined),
	guidance: 'the remedy line',
});

describe('buildFileExportCheck', () => {
	test('asks for file text, and reports one finding per violating file in the rule’s own words', async () => {
		expect(check.inputKinds).toStrictEqual(['file-text']);

		const input = setupFileTextInput({
			contents: [
				['src/pair.ts', 'export const one = 1;\nexport const two = 2;\n'],
				['src/single.ts', 'export const only = 1;\n'],
			],
		});

		expect(await check.run({ inputs: { 'file-text': input }, options: {} })).toStrictEqual([
			{ siteKey: 'demo-exports:src/pair.ts', files: [{ path: 'src/pair.ts' }], detail: '2 exports', guidance: 'the remedy line' },
		]);
	});

	test('inside a declared pack, a rule under tests/ is ordinary source and is judged like any other file', async () => {
		const input = setupFileTextInput({
			contents: [['standards/tests/code-style/10-rule/check.ts', 'export const one = 1;\nexport const two = 2;\n']],
			standardsLibraries: ['standards'],
		});

		expect(await check.run({ inputs: { 'file-text': input }, options: {} })).toStrictEqual([
			{
				siteKey: 'demo-exports:standards/tests/code-style/10-rule/check.ts',
				files: [{ path: 'standards/tests/code-style/10-rule/check.ts' }],
				detail: '2 exports',
				guidance: 'the remedy line',
			},
		]);
	});

	test('the same path with no pack declared above it is a tests/ directory, and goes unjudged', async () => {
		const input = setupFileTextInput({
			contents: [['standards/tests/code-style/10-rule/check.ts', 'export const one = 1;\nexport const two = 2;\n']],
		});

		expect(await check.run({ inputs: { 'file-text': input }, options: {} })).toStrictEqual([]);
	});

	test('an index file and a test file are exempt — one declares nothing of its own, the other belongs to the test standards', async () => {
		const input = setupFileTextInput({
			contents: [
				['src/feature/index.ts', "export { one } from './one';\nexport { two } from './two';\n"],
				['src/feature/one.unit.test.ts', 'export const helperA = 1;\nexport const helperB = 2;\n'],
			],
		});

		expect(await check.run({ inputs: { 'file-text': input }, options: {} })).toStrictEqual([]);
	});
});
