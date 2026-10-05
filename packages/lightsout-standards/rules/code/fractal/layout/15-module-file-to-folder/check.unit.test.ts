import { describe, expect, test } from '@jest/globals';
import { setupFileListInput } from '@lightsout/standards-testkit';
import { check } from './check.ts';

describe('module-file-to-folder check', () => {
	test('asks for the file list alone, since a folder is judged by the files in it', () => {
		expect(check.inputKinds).toStrictEqual(['file-list']);
	});

	test('reports a module folder holding only its main file and that file’s test', async () => {
		const input = setupFileListInput({
			files: ['src/billing/RateLimiter/RateLimiter.ts', 'src/billing/RateLimiter/RateLimiter.unit.test.ts'],
			tests: ['src/billing/RateLimiter/RateLimiter.unit.test.ts'],
		});

		const findings = await check.run({ inputs: { 'file-list': input }, options: {} });

		expect(findings).toStrictEqual([
			{
				siteKey: 'module-file-to-folder:src/billing/RateLimiter',
				files: [{ path: 'src/billing/RateLimiter' }],
				detail: "folder 'RateLimiter' holds only its main file",
				guidance: 'Turn the module back into a file: move the main file, and its test, up one folder and delete this one.',
			},
		]);
	});

	test.each([
		{ shape: 'a second file', extra: 'src/billing/RetryPolicy/getDelay.ts' },
		{ shape: 'a common/ folder', extra: 'src/billing/RetryPolicy/common/roundDelay.ts' },
		{ shape: 'a module folder inside it', extra: 'src/billing/RetryPolicy/getDelay/getDelay.ts' },
	])('accepts a module folder that also holds $shape', async ({ extra }) => {
		const input = setupFileListInput({ files: ['src/billing/RetryPolicy/RetryPolicy.ts', extra, 'src/billing/RetryPolicy/getDelay/readRate.ts'] });

		const findings = await check.run({ inputs: { 'file-list': input }, options: {} });

		expect(findings).toStrictEqual([]);
	});

	test('leaves a folder with one file under another name alone, since it is a subject folder', async () => {
		const input = setupFileListInput({ files: ['src/billing/chargeCustomer.ts'] });

		const findings = await check.run({ inputs: { 'file-list': input }, options: {} });

		expect(findings).toStrictEqual([]);
	});

	test('judges only folders under src/', async () => {
		const input = setupFileListInput({ files: ['scripts/release/release.ts', 'src/release/release.ts'] });

		const findings = await check.run({ inputs: { 'file-list': input }, options: {} });

		expect(findings.map(({ siteKey }) => siteKey)).toStrictEqual(['module-file-to-folder:src/release']);
	});

	test('reports nothing when its input is missing rather than refusing', async () => {
		expect(await check.run({ inputs: {}, options: {} })).toStrictEqual([]);
	});
});
