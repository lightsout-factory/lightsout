import { describe, expect, test } from '@jest/globals';
import { setupTestFileInput } from '@lightsout/standards-testkit';
import { buildTestLimitCheck } from './buildTestLimitCheck.ts';

const check = buildTestLimitCheck({
	rule: 'demo-limit',
	option: 'maxLines',
	// Reports a file over the limit by its line count — the one part such rules differ in.
	report: ({ file, text, limit }) => {
		const lines = text.split('\n').length;

		return lines > limit ? { files: [{ path: file }], detail: `${lines} lines (cap ${limit})` } : undefined;
	},
	guidance: 'the remedy line',
});

const measuredCheck = buildTestLimitCheck({
	rule: 'demo-measured-limit',
	option: 'maxLines',
	// Reports the same line count as a number beside the prose, the way a capped rule now does.
	report: ({ file, text, limit }) => {
		const lines = text.split('\n').length;

		return lines > limit ? { files: [{ path: file }], detail: `${lines} lines (cap ${limit})`, measure: lines } : undefined;
	},
	guidance: 'the remedy line',
});

describe('buildTestLimitCheck', () => {
	test('asks for test files, resolves the named option, and reports what the measurement returns', async () => {
		expect(check.inputKind).toBe('test-file');

		const input = setupTestFileInput({
			contents: [
				['src/long.unit.test.ts', 'a\nb\nc\nd'],
				['src/short.unit.test.ts', 'a\nb'],
			],
		});

		expect(await check.run({ input, options: { maxLines: 3 } })).toStrictEqual([
			{ siteKey: 'demo-limit:src/long.unit.test.ts', files: [{ path: 'src/long.unit.test.ts' }], detail: '4 lines (cap 3)', guidance: 'the remedy line' },
		]);
	});

	test('a file inside the limit contributes nothing', async () => {
		const input = setupTestFileInput({ contents: [['src/fits.unit.test.ts', 'a\nb\nc']] });

		expect(await check.run({ input, options: { maxLines: 3 } })).toStrictEqual([]);
	});

	test('threads a measurement the report supplies and omits the key when it supplies none', async () => {
		const input = setupTestFileInput({ contents: [['src/long.unit.test.ts', 'a\nb\nc\nd']] });

		const measured = await measuredCheck.run({ input, options: { maxLines: 3 } });
		const unmeasured = await check.run({ input, options: { maxLines: 3 } });

		expect(measured).toStrictEqual([
			{
				siteKey: 'demo-measured-limit:src/long.unit.test.ts',
				files: [{ path: 'src/long.unit.test.ts' }],
				detail: '4 lines (cap 3)',
				guidance: 'the remedy line',
				measure: 4,
			},
		]);
		expect(unmeasured).toStrictEqual([
			{ siteKey: 'demo-limit:src/long.unit.test.ts', files: [{ path: 'src/long.unit.test.ts' }], detail: '4 lines (cap 3)', guidance: 'the remedy line' },
		]);
	});

	test('resolves the named option and measures against it', async () => {
		const optionCheck = buildTestLimitCheck({
			rule: 'demo-option-limit',
			option: 'maxLines',
			report: ({ file, text, limit }) => {
				const lines = text.split('\n').length;

				return lines > limit ? { files: [{ path: file }], detail: `${lines} lines (cap ${limit})` } : undefined;
			},
			guidance: 'the remedy line',
		});
		const input = setupTestFileInput({ contents: [['src/four.unit.test.ts', 'a\nb\nc\nd']] });

		const overCap = await optionCheck.run({ input, options: { maxLines: 3 } });
		const atCap = await optionCheck.run({ input, options: { maxLines: 4 } });

		expect({ overCap, atCap }).toStrictEqual({
			overCap: [
				{
					siteKey: 'demo-option-limit:src/four.unit.test.ts',
					files: [{ path: 'src/four.unit.test.ts' }],
					detail: '4 lines (cap 3)',
					guidance: 'the remedy line',
				},
			],
			atCap: [],
		});
	});
});
