import { describe, expect, test } from '@jest/globals';
import { setupTestFileInput } from '@lightsout/standards-testkit';
import { check } from './check.ts';

/** A test file spanning exactly `lines` lines, each of them a trivial test case. */
const buildTestSource = ({ lines }: { lines: number }) => Array.from({ length: lines }, (_, index) => `test('case ${index}', () => {});`).join('\n');

describe('test-file-size check', () => {
	test('asks for test files, the one input kind that carries test text alone', () => {
		expect(check.inputKinds).toStrictEqual(['test-file']);
	});

	test('reports a test file past the cap, stating the count and the cap it broke', async () => {
		const input = setupTestFileInput({ contents: [['src/doctor/runDoctor.unit.test.ts', buildTestSource({ lines: 6 })]] });

		const findings = await check.run({ inputs: { 'test-file': input }, options: { testFile: 5 } });

		expect(findings).toStrictEqual([
			{
				siteKey: 'test-file-size:src/doctor/runDoctor.unit.test.ts',
				files: [{ path: 'src/doctor/runDoctor.unit.test.ts' }],
				detail: '6 lines (cap ~5)',
				guidance: 'Split it by named scenario, one concern per file.',
				measure: 6,
			},
		]);
	});

	test('leaves a test file at the cap alone — the cap is a ceiling, not a target to stay clear of', async () => {
		const input = setupTestFileInput({ contents: [['src/feature/renderGreeting.unit.test.ts', buildTestSource({ lines: 5 })]] });

		const findings = await check.run({ inputs: { 'test-file': input }, options: { testFile: 5 } });

		expect(findings).toStrictEqual([]);
	});

	test("reports the test file's line count as the measure", async () => {
		const input = setupTestFileInput({
			contents: [
				['src/doctor/runDoctor.unit.test.ts', buildTestSource({ lines: 4 })],
				['src/doctor/runQuick.unit.test.ts', buildTestSource({ lines: 2 })],
			],
		});

		const findings = await check.run({ inputs: { 'test-file': input }, options: { testFile: 3 } });

		expect(findings).toStrictEqual([
			{
				siteKey: 'test-file-size:src/doctor/runDoctor.unit.test.ts',
				files: [{ path: 'src/doctor/runDoctor.unit.test.ts' }],
				detail: '4 lines (cap ~3)',
				guidance: 'Split it by named scenario, one concern per file.',
				measure: 4,
			},
		]);
	});

	test('reports each oversized file on its own, so one monster cannot hide another', async () => {
		const input = setupTestFileInput({
			contents: [
				['src/a/runA.unit.test.ts', buildTestSource({ lines: 7 })],
				['src/b/runB.unit.test.ts', buildTestSource({ lines: 3 })],
				['src/c/runC.unit.test.ts', buildTestSource({ lines: 9 })],
			],
		});

		const findings = await check.run({ inputs: { 'test-file': input }, options: { testFile: 5 } });

		expect(findings.map((finding) => finding.files[0]?.path)).toStrictEqual(['src/a/runA.unit.test.ts', 'src/c/runC.unit.test.ts']);
	});

	test('measures each test file against the testFile option', async () => {
		const input = setupTestFileInput({
			contents: [
				['src/over/runOver.unit.test.ts', buildTestSource({ lines: 5 })],
				['src/at/runAt.unit.test.ts', buildTestSource({ lines: 4 })],
			],
		});

		const findings = await check.run({ inputs: { 'test-file': input }, options: { testFile: 4 } });

		expect(findings).toStrictEqual([
			{
				siteKey: 'test-file-size:src/over/runOver.unit.test.ts',
				files: [{ path: 'src/over/runOver.unit.test.ts' }],
				detail: '5 lines (cap ~4)',
				guidance: 'Split it by named scenario, one concern per file.',
				measure: 5,
			},
		]);
	});

	test('reports nothing when its input is missing rather than refusing', async () => {
		const findings = await check.run({ inputs: {}, options: { testFile: 5 } });

		expect(findings).toStrictEqual([]);
	});
});
