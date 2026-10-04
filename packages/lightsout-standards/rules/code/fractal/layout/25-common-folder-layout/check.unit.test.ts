import { describe, expect, test } from '@jest/globals';
import { setupFileTextInput } from '@lightsout/standards-testkit';
import { check } from './check.ts';

const functionText = 'export const formatRate = ({ rate }: { rate: number }): string => `${rate}`;';
const typeText = ['export interface Rate {', '\tvalue: number;', '}'].join('\n');
const constantText = 'export const rateLimits = { min: 0, max: 1 } as const;';

const runCheck = async ({ contents, tests = [], cap = 20 }: { contents: Array<[string, string]>; tests?: string[]; cap?: number }) =>
	check.run({ inputs: { 'file-text': setupFileTextInput({ contents, tests }) }, options: { cap } });

/** `count` functions sitting directly in `folder`, named so no two collide. */
const setupFunctions = ({ folder, count }: { folder: string; count: number }): Array<[string, string]> =>
	Array.from({ length: count }, (_, index) => [`${folder}/formatRate${index}.ts`, functionText]);

describe('common-folder-layout check', () => {
	test('asks for file text, since the folder a shared file goes in is decided by what it exports', () => {
		expect(check.inputKinds).toStrictEqual(['file-text']);
	});

	test('accepts a function directly in common/, a type in types/ and a constant in constants/', async () => {
		const findings = await runCheck({
			contents: [
				['src/billing/common/formatRate.ts', functionText],
				['src/billing/common/RateClient.ts', 'export class RateClient {}'],
				['src/billing/common/types/Rate.ts', typeText],
				['src/billing/common/constants/rateLimits.ts', constantText],
			],
		});

		expect(findings).toStrictEqual([]);
	});

	test.each([
		{
			shape: 'a type',
			path: 'src/billing/common/Rate.ts',
			text: typeText,
			detail: "'Rate.ts' holds a type and sits directly in src/billing/common",
			guidance: 'Move it to `common/types/`.',
		},
		{
			shape: 'a constant',
			path: 'src/billing/common/rateLimits.ts',
			text: constantText,
			detail: "'rateLimits.ts' holds a constant and sits directly in src/billing/common",
			guidance: 'Move it to `common/constants/`.',
		},
	])('reports $shape sitting directly in common/', async ({ path, text, detail, guidance }) => {
		const findings = await runCheck({ contents: [[path, text]] });

		expect(findings).toStrictEqual([{ siteKey: `common-folder-layout:${path}`, files: [{ path }], detail, guidance }]);
	});

	test.each([
		{
			shape: 'a function in types/',
			path: 'src/common/types/formatRate.ts',
			text: functionText,
			kind: 'function',
			guidance: 'Move it directly into `common/`: only types and constants have a folder of their own.',
		},
		{
			shape: 'a class in constants/',
			path: 'src/common/constants/RateClient.ts',
			text: 'export class RateClient {}',
			kind: 'function',
			guidance: 'Move it directly into `common/`: only types and constants have a folder of their own.',
		},
		{
			shape: 'a constant in types/',
			path: 'src/common/types/rateLimits.ts',
			text: constantText,
			kind: 'constant',
			guidance: 'Move it to `common/constants/`.',
		},
		{ shape: 'a type in constants/', path: 'src/common/constants/Rate.ts', text: typeText, kind: 'type', guidance: 'Move it to `common/types/`.' },
	])('reports $shape', async ({ path, text, kind, guidance }) => {
		const findings = await runCheck({ contents: [[path, text]] });

		expect(findings.map(({ detail, guidance: found }) => ({ detail, guidance: found }))).toStrictEqual([
			{ detail: `'${path.split('/').at(-1)}' holds a ${kind} and sits in ${path.slice(0, path.lastIndexOf('/'))}`, guidance },
		]);
	});

	test('files a constant object with its derived type under constants/, since a file with a type and a value goes by its value', async () => {
		const text = ["export const SyncState = { idle: 'idle' } as const;", 'export type SyncState = (typeof SyncState)[keyof typeof SyncState];'].join('\n');

		const findings = await runCheck({
			contents: [
				['src/common/constants/SyncState.ts', text],
				['src/common/types/SyncState.ts', text],
			],
		});

		expect(findings.map((finding) => finding.siteKey)).toStrictEqual(['common-folder-layout:src/common/types/SyncState.ts']);
	});

	test('files a const built by a call as a constant, since what the call returns cannot be read from the line', async () => {
		const findings = await runCheck({
			contents: [
				['src/common/constants/rateSchema.ts', 'export const rateSchema = z.object({});'],
				['src/common/sendRate.ts', 'export const sendRate = withRetry(postRate);'],
			],
		});

		expect(findings.map(({ siteKey, guidance }) => ({ siteKey, guidance }))).toStrictEqual([
			{ siteKey: 'common-folder-layout:src/common/sendRate.ts', guidance: 'Move it to `common/constants/`.' },
		]);
	});

	test('reports a folder in a common/ that holds no more files than the cap, and leaves a banned name to the folder-name rule', async () => {
		const findings = await runCheck({
			contents: [
				['src/common/utils/formatRate.ts', functionText],
				['src/common/formatting/padCell.ts', functionText],
				['src/common/formatting/trimCell.ts', functionText],
				['src/common/readRate.ts', functionText],
				['src/common/types/Rate.ts', typeText],
			],
			cap: 4,
		});

		expect(findings).toStrictEqual([
			{
				siteKey: 'common-folder-layout:src/common/formatting',
				files: [{ path: 'src/common/formatting' }],
				detail: "folder 'formatting' groups files in a common/ that holds 3 (cap 4)",
				guidance: 'Move its files directly into `common/`. A `common/` is grouped by subject only once it holds more files than the cap.',
			},
		]);
	});

	test('accepts subject folders once the common/ holds more files than the cap', async () => {
		const findings = await runCheck({
			contents: [...setupFunctions({ folder: 'src/common/formatting', count: 3 }), ...setupFunctions({ folder: 'src/common/parsing', count: 2 })],
			cap: 4,
		});

		expect(findings).toStrictEqual([]);
	});

	test('accepts a module folder in a small common/, and counts it as the one function it is', async () => {
		const findings = await runCheck({
			contents: [
				['src/common/formatRate/formatRate.ts', functionText],
				['src/common/formatRate/roundRate.ts', functionText],
				['src/common/formatRate/padRate.ts', functionText],
				['src/common/formatting/padCell.ts', functionText],
			],
			cap: 2,
		});

		// one module folder plus one file in formatting/ is two, which is not past the cap
		expect(findings.map((finding) => finding.siteKey)).toStrictEqual(['common-folder-layout:src/common/formatting']);
	});

	test('judges each common/ on its own count', async () => {
		const findings = await runCheck({
			contents: [...setupFunctions({ folder: 'src/common/formatting', count: 5 }), ['src/billing/common/formatting/padCell.ts', functionText]],
			cap: 4,
		});

		expect(findings.map((finding) => finding.siteKey)).toStrictEqual(['common-folder-layout:src/billing/common/formatting']);
	});

	test('leaves alone files that sit nowhere near a common/ folder', async () => {
		const findings = await runCheck({
			contents: [
				['src/billing/Rate.ts', typeText],
				['src/billing/types/Rate.ts', typeText],
				['src/commonplace/Rate.ts', typeText],
			],
		});

		expect(findings).toStrictEqual([]);
	});

	test('leaves a test file and an index file in common/ alone', async () => {
		const findings = await runCheck({
			contents: [
				['src/common/Rate.unit.test.ts', typeText],
				['src/common/index.ts', typeText],
				['src/common/index.mjs', typeText],
			],
		});

		expect(findings).toStrictEqual([]);
	});

	test('reports nothing when its input is missing rather than refusing', async () => {
		expect(await check.run({ inputs: {}, options: { cap: 20 } })).toStrictEqual([]);
	});
});
