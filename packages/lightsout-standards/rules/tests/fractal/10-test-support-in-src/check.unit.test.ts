import { describe, expect, test } from '@jest/globals';
import { setupFileListInput } from '@lightsout/standards-testkit';
import { check } from './check.ts';

describe('test-support-in-src check', () => {
	test('asks for the file list alone, since a folder is judged by its name and its place', () => {
		expect(check.inputKinds).toStrictEqual(['file-list']);
	});

	test('reports a shared fixtures folder living under src/, naming the folder rather than its files', async () => {
		const input = setupFileListInput({ source: ['src/feature/getLabel.ts', 'src/feature/fixtures/sampleLabel.ts'] });

		const findings = await check.run({ inputs: { 'file-list': input }, options: {} });

		expect(findings).toStrictEqual([
			{
				siteKey: 'test-support-in-src:src/feature/fixtures',
				files: [{ path: 'src/feature/fixtures' }],
				detail: "test-support folder 'fixtures' under src/",
				guidance: "Move it to the package's `tests/` folder, outside `src/`.",
			},
		]);
	});

	test.each([{ folder: 'fixtures' }, { folder: 'mocks' }, { folder: '__mocks__' }, { folder: 'testUtils' }, { folder: 'test-utils' }])(
		'names $folder among the test-support folders it places outside src/, restated here so one dropped from the list stops enforcing loudly',
		async ({ folder }) => {
			const input = setupFileListInput({ source: [`src/feature/${folder}/sampleLabel.ts`] });

			const findings = await check.run({ inputs: { 'file-list': input }, options: {} });

			expect(findings.map(({ siteKey }) => siteKey)).toStrictEqual([`test-support-in-src:src/feature/${folder}`]);
		},
	);

	test('leaves helpers alone, which the folder-name rule owns', async () => {
		const input = setupFileListInput({ source: ['src/feature/helpers/buildLabel.ts'] });

		const findings = await check.run({ inputs: { 'file-list': input }, options: {} });

		expect(findings).toStrictEqual([]);
	});

	test("leaves the same folder names alone outside src/, where they are the package's sanctioned test-support locations", async () => {
		const input = setupFileListInput({ source: ['tests/fixtures/sampleLabel.ts', 'test/mocks/getLabel.ts', 'testUtils/buildRepo.ts'] });

		const findings = await check.run({ inputs: { 'file-list': input }, options: {} });

		expect(findings).toStrictEqual([]);
	});

	test('reports each misplaced folder once however many files it holds, in path order', async () => {
		const input = setupFileListInput({
			source: ['src/b/mocks/one.ts', 'src/b/mocks/two.ts', 'src/a/fixtures/three.ts', 'src/a/fixtures/nested/four.ts'],
		});

		const findings = await check.run({ inputs: { 'file-list': input }, options: {} });

		expect(findings.map(({ siteKey }) => siteKey)).toStrictEqual(['test-support-in-src:src/a/fixtures', 'test-support-in-src:src/b/mocks']);
	});

	test('reports nothing when its input is missing rather than refusing', async () => {
		const findings = await check.run({ inputs: {}, options: {} });

		expect(findings).toStrictEqual([]);
	});
});
