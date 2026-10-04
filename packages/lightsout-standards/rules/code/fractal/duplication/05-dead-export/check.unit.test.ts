import { describe, expect, test } from '@jest/globals';
import type { FileTextInput } from '@lightsout/standards-contracts';
import { StandardsInputKind } from '@lightsout/standards-contracts';

import { check } from './check.ts';

/** A repo as the engine hands it to a file-text rule: every path in scope, with its text. */
const setupFileTextInput = ({ contents, standardsLibraries = [] }: { contents: Array<[string, string]>; standardsLibraries?: string[] }): FileTextInput => {
	const files = contents.map(([path]) => path);

	return {
		kind: StandardsInputKind.FileText,
		cwd: '/repo',
		source: files,
		tests: files.filter((path) => path.includes('.test.')),
		files,
		referenceFiles: [],
		contents: new Map(contents),
		standardsLibraries,
	};
};

describe('dead-export check', () => {
	test('asks for file text, since the verdict counts mentions across the repo', () => {
		expect(check.inputKinds).toStrictEqual(['file-text']);
	});

	test('reports an export no module or test mentions, a folder barrel listing it aside', async () => {
		const input = setupFileTextInput({
			contents: [
				['src/feature/index.ts', "export { renderGreeting, buildGreeting } from './renderGreeting';"],
				['src/app.ts', 'renderGreeting();'],
				['src/feature/renderGreeting.ts', 'export const renderGreeting = ({ name }: { name: string }): string => `<p>${name}</p>`;'],
				['src/feature/buildGreeting.ts', 'export const buildGreeting = ({ name }: { name: string }): string => `Hello, ${name}.`;'],
			],
		});

		const findings = await check.run({ inputs: { 'file-text': input }, options: {} });

		expect(findings).toStrictEqual([
			{
				siteKey: 'dead-export:src/feature/buildGreeting.ts',
				files: [{ path: 'src/feature/buildGreeting.ts' }],
				detail: "'buildGreeting' is referenced nowhere else",
				guidance: 'Nothing references it. Delete it.',
			},
		]);
	});

	test('leaves alone an export a package entry lists or a test reaches — the entry is read by other packages, and a test’s use is a use', async () => {
		const input = setupFileTextInput({
			contents: [
				['src/index.ts', "export { renderGreeting } from './feature/renderGreeting';"],
				['src/feature/renderGreeting.ts', 'export const renderGreeting = ({ name }: { name: string }): string => `<p>${name}</p>`;'],
				['src/feature/buildGreeting.ts', 'export const buildGreeting = ({ name }: { name: string }): string => `Hello, ${name}.`;'],
				['src/feature/buildGreeting.unit.test.ts', "import { buildGreeting } from './buildGreeting';"],
			],
		});

		const findings = await check.run({ inputs: { 'file-text': input }, options: {} });

		expect(findings).toStrictEqual([]);
	});

	test('every dead export of one file lands in a single finding that names each', async () => {
		const input = setupFileTextInput({ contents: [['src/feature/tokens.ts', 'export const alphaToken = 1;\nexport const betaToken = 2;']] });

		const findings = await check.run({ inputs: { 'file-text': input }, options: {} });

		expect(findings.map((finding) => finding.detail)).toStrictEqual(["'alphaToken', 'betaToken' are referenced nowhere else"]);
	});

	test('inside a declared library, a rule under tests/ declares an export the check judges', async () => {
		const input = setupFileTextInput({
			contents: [['standards/rules/tests/code-style/10-rule/check.ts', 'export const checkRule = (): number => 1;']],
			standardsLibraries: ['standards'],
		});

		const findings = await check.run({ inputs: { 'file-text': input }, options: {} });

		expect(findings.map((finding) => finding.siteKey)).toStrictEqual(['dead-export:standards/rules/tests/code-style/10-rule/check.ts']);
	});

	test('the same path with no library declared above it is test code, whose own helpers are nobody’s public API', async () => {
		const input = setupFileTextInput({ contents: [['standards/rules/tests/code-style/10-rule/check.ts', 'export const checkRule = (): number => 1;']] });

		const findings = await check.run({ inputs: { 'file-text': input }, options: {} });

		expect(findings).toStrictEqual([]);
	});

	test('reports nothing when its input is missing rather than refusing', async () => {
		const findings = await check.run({ inputs: {}, options: {} });

		expect(findings).toStrictEqual([]);
	});
});
