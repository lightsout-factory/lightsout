import { describe, expect, test } from '@jest/globals';
import { setupFileListInput } from '@lightsout/standards-testkit';
import { check } from './check.ts';

const separatedGuidance = 'A unit test sits beside the file it tests — move it next to its subject rather than into a separate directory.';
const orphanedGuidance =
	'The first name segment must name a real source file in the same folder; a scenario suite qualifies it as `<File>.<scenario>.unit.test.ts` with a camelCase qualifier.';

describe('test-beside-subject check', () => {
	test('asks for the file list alone, since where a test sits and what it names are read from its path', () => {
		expect(check.inputKinds).toStrictEqual(['file-list']);
	});

	test('reports a unit test filed away from its subject, naming the folder it was filed into', async () => {
		const input = setupFileListInput({ source: ['src/feature/getLabel.ts'], tests: ['src/feature/tests/getLabel.unit.test.ts'] });

		const findings = await check.run({ inputs: { 'file-list': input }, options: {} });

		// one finding, for the folder: the missing subject beside it is the same mistake, not a second one
		expect(findings).toStrictEqual([
			{
				siteKey: 'test-beside-subject:src/feature/tests/getLabel.unit.test.ts',
				files: [{ path: 'src/feature/tests/getLabel.unit.test.ts' }],
				detail: 'a unit test in src/feature/tests',
				guidance: separatedGuidance,
			},
		]);
	});

	test.each([{ directory: '__tests__' }, { directory: 'tests' }, { directory: 'test' }])(
		'names $directory among the folder names it refuses, restated here so one dropped from the list stops enforcing loudly',
		async ({ directory }) => {
			const input = setupFileListInput({
				source: ['src/feature/getLabel.ts', `src/feature/${directory}/getLabel.ts`],
				tests: [`src/feature/${directory}/getLabel.unit.test.ts`],
			});

			const findings = await check.run({ inputs: { 'file-list': input }, options: {} });

			// a subject sits beside the test here, so only the folder name can be what is reported
			expect(findings.map(({ detail }) => detail)).toStrictEqual([`a unit test in src/feature/${directory}`]);
		},
	);

	test('objects to a refused folder anywhere above the test, not only the one directly holding it', async () => {
		const input = setupFileListInput({ source: ['src/feature/getLabel.ts'], tests: ['src/tests/feature/nested/getLabel.unit.test.ts'] });

		const findings = await check.run({ inputs: { 'file-list': input }, options: {} });

		expect(findings.map(({ detail }) => detail)).toStrictEqual(['a unit test in src/tests/feature/nested']);
	});

	test('reports a test whose first name segment names no source file beside it', async () => {
		const input = setupFileListInput({ source: ['src/feature/getLabel.ts'], tests: ['src/feature/labelling.unit.test.ts'] });

		const findings = await check.run({ inputs: { 'file-list': input }, options: {} });

		expect(findings).toStrictEqual([
			{
				siteKey: 'test-beside-subject:src/feature/labelling.unit.test.ts',
				files: [{ path: 'src/feature/labelling.unit.test.ts' }],
				detail: "no source file named 'labelling' in src/feature",
				guidance: orphanedGuidance,
			},
		]);
	});

	test('leaves a test sitting beside the file it names alone', async () => {
		const input = setupFileListInput({ source: ['src/feature/getLabel.ts'], tests: ['src/feature/getLabel.unit.test.ts'] });

		const findings = await check.run({ inputs: { 'file-list': input }, options: {} });

		expect(findings).toStrictEqual([]);
	});

	test('accepts a scenario suite, whose qualifier sits after the segment naming the subject', async () => {
		const input = setupFileListInput({
			source: ['src/pipeline/runPipeline.ts'],
			tests: ['src/pipeline/runPipeline.monorepo.unit.test.ts', 'src/pipeline/runPipeline.nested.unit.test.ts'],
		});

		const findings = await check.run({ inputs: { 'file-list': input }, options: {} });

		expect(findings).toStrictEqual([]);
	});

	test.each([{ extension: 'ts' }, { extension: 'tsx' }, { extension: 'js' }, { extension: 'jsx' }, { extension: 'mjs' }, { extension: 'cjs' }])(
		'accepts a subject written as .$extension, so a JavaScript repo is judged at full strength too',
		async ({ extension }) => {
			const input = setupFileListInput({ source: [`src/feature/getLabel.${extension}`], tests: ['src/feature/getLabel.unit.test.ts'] });

			const findings = await check.run({ inputs: { 'file-list': input }, options: {} });

			expect(findings).toStrictEqual([]);
		},
	);

	test('a file of that name in another folder does not count — the subject is looked for in the test’s own folder', async () => {
		const input = setupFileListInput({ source: ['src/other/getLabel.ts'], tests: ['src/feature/getLabel.unit.test.ts'] });

		const findings = await check.run({ inputs: { 'file-list': input }, options: {} });

		expect(findings.map(({ detail }) => detail)).toStrictEqual(["no source file named 'getLabel' in src/feature"]);
	});

	test("leaves a package's own tests/ tree alone, since outside src/ those names are the sanctioned test-support locations", async () => {
		const input = setupFileListInput({
			source: ['src/feature/getLabel.ts'],
			tests: [
				'tests/e2e/runPipeline.e2e.test.ts',
				'tests/integration/labelling.integration.test.ts',
				'test/fixtures/buildRepo.ts',
				'__tests__/legacy/getLabel.unit.test.ts',
			],
		});

		const findings = await check.run({ inputs: { 'file-list': input }, options: {} });

		expect(findings).toStrictEqual([]);
	});

	test('reports each misplaced test on its own, in the order the input lists them', async () => {
		const input = setupFileListInput({
			source: ['src/a/getA.ts', 'src/b/getB.ts'],
			tests: ['src/a/tests/getA.unit.test.ts', 'src/b/getB.unit.test.ts', 'src/b/rendering.unit.test.ts', 'src/b/__tests__/getB.other.unit.test.ts'],
		});

		const findings = await check.run({ inputs: { 'file-list': input }, options: {} });

		expect(findings.map(({ siteKey }) => siteKey)).toStrictEqual([
			'test-beside-subject:src/a/tests/getA.unit.test.ts',
			'test-beside-subject:src/b/rendering.unit.test.ts',
			'test-beside-subject:src/b/__tests__/getB.other.unit.test.ts',
		]);
	});

	test('reports nothing when its input is missing rather than refusing', async () => {
		const findings = await check.run({ inputs: {}, options: {} });

		expect(findings).toStrictEqual([]);
	});
});
