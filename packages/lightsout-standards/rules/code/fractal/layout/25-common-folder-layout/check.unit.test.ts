import { describe, expect, test } from '@jest/globals';
import { setupFileTextInput } from '@lightsout/standards-testkit';
import { check } from './check.ts';

const functionText = 'export const formatRate = ({ rate }: { rate: number }): string => `${rate}`;';
const typeText = ['export interface Rate {', '\tvalue: number;', '}'].join('\n');
const constantText = 'export const rateLimits = { min: 0, max: 1 } as const;';

const runCheck = async ({ contents, tests = [] }: { contents: Array<[string, string]>; tests?: string[] }) =>
	check.run({ inputs: { 'file-text': setupFileTextInput({ contents, tests }) }, options: {} });

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

	test('reads a function whose arrow starts on the line after the `=` as a function', async () => {
		const text = ['export const createSender =', '\t({ retries }: { retries: number }) =>', '\t({ rate }: { rate: number }) =>', '\t\tretries + rate;'].join(
			'\n',
		);

		const findings = await runCheck({
			contents: [
				['src/common/createSender.ts', text],
				['src/common/constants/createSender.ts', text],
			],
		});

		expect(findings.map(({ siteKey, guidance }) => ({ siteKey, guidance }))).toStrictEqual([
			{
				siteKey: 'common-folder-layout:src/common/constants/createSender.ts',
				guidance: 'Move it directly into `common/`: only types and constants have a folder of their own.',
			},
		]);
	});

	test('judges a module folder by its main file, wherever in the common/ the folder sits', async () => {
		const findings = await runCheck({
			contents: [
				['src/common/constants/formatRate/formatRate.ts', functionText],
				['src/common/constants/formatRate/roundRate.ts', functionText],
				['src/common/sendRate/sendRate.ts', functionText],
			],
		});

		// the private file beside a main file is the module's own, so only the main file is judged
		expect(findings.map((finding) => finding.siteKey)).toStrictEqual(['common-folder-layout:src/common/constants/formatRate/formatRate.ts']);
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
		expect(await check.run({ inputs: {}, options: {} })).toStrictEqual([]);
	});
});
