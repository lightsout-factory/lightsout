import { describe, expect, test } from '@jest/globals';
import { setupFileListInput } from '@lightsout/standards-testkit';
import { check } from './check.ts';

describe('folder-size check', () => {
	test('asks for the file list alone, since a folder is counted from the paths in it', () => {
		expect(check.inputKinds).toStrictEqual(['file-list']);
	});

	test('reports a folder holding more files than the cap', async () => {
		const input = setupFileListInput({ files: ['src/wide/a.ts', 'src/wide/b.ts', 'src/wide/c.ts', 'src/wide/d.ts'] });

		const findings = await check.run({ inputs: { 'file-list': input }, options: { cap: 3 } });

		expect(findings).toStrictEqual([
			{
				siteKey: 'folder-size:src/wide',
				files: [{ path: 'src/wide' }],
				detail: '4 files in one flat folder (cap ~3)',
				guidance: 'Group them by domain, or graduate the concepts hiding in the pile.',
				measure: 4,
			},
		]);
	});

	test('leaves a folder sitting exactly at the cap alone', async () => {
		const input = setupFileListInput({ files: ['src/narrow/a.ts', 'src/narrow/b.ts', 'src/narrow/c.ts'] });

		const findings = await check.run({ inputs: { 'file-list': input }, options: { cap: 3 } });

		expect(findings).toStrictEqual([]);
	});

	test('counts the barrel too, since it is a line in the directory listing like any other', async () => {
		const input = setupFileListInput({ files: ['src/wide/a.ts', 'src/wide/b.ts', 'src/wide/c.ts', 'src/wide/index.ts'] });

		const findings = await check.run({ inputs: { 'file-list': input }, options: { cap: 3 } });

		expect(findings.map(({ detail }) => detail)).toStrictEqual(['4 files in one flat folder (cap ~3)']);
	});

	test('never counts a test beside its subject, so obeying the co-location rule cannot push a folder over', async () => {
		const input = setupFileListInput({
			files: ['src/wide/a.ts', 'src/wide/b.ts', 'src/wide/c.ts', 'src/wide/a.unit.test.ts'],
			tests: ['src/wide/a.unit.test.ts'],
		});

		const findings = await check.run({ inputs: { 'file-list': input }, options: { cap: 3 } });

		expect(findings).toStrictEqual([]);
	});

	test('counts each folder on its own, so files in a subfolder never roll up into the parent', async () => {
		const input = setupFileListInput({
			files: ['src/wide/a.ts', 'src/wide/b.ts', 'src/wide/c.ts', 'src/wide/d.ts', 'src/wide/deep/e.ts', 'src/wide/deep/f.ts'],
		});

		const findings = await check.run({ inputs: { 'file-list': input }, options: { cap: 3 } });

		expect(findings).toStrictEqual([
			{
				siteKey: 'folder-size:src/wide',
				files: [{ path: 'src/wide' }],
				detail: '4 files in one flat folder (cap ~3)',
				guidance: 'Group them by domain, or graduate the concepts hiding in the pile.',
				measure: 4,
			},
		]);
	});

	test('reports every oversized folder separately, so each one carries its own site key', async () => {
		const input = setupFileListInput({
			files: ['src/wide/a.ts', 'src/wide/b.ts', 'src/wide/c.ts', 'src/narrow/a.ts', 'src/other/a.ts', 'src/other/b.ts', 'src/other/c.ts'],
		});

		const findings = await check.run({ inputs: { 'file-list': input }, options: { cap: 2 } });

		expect(findings.map(({ siteKey }) => siteKey)).toStrictEqual(['folder-size:src/wide', 'folder-size:src/other']);
	});

	test('names the repo root as the folder when the pile sits at the top level', async () => {
		const input = setupFileListInput({ files: ['a.ts', 'b.ts', 'c.ts'] });

		const findings = await check.run({ inputs: { 'file-list': input }, options: { cap: 2 } });

		expect(findings).toStrictEqual([
			{
				siteKey: 'folder-size:.',
				files: [{ path: '.' }],
				detail: '3 files in one flat folder (cap ~2)',
				guidance: 'Group them by domain, or graduate the concepts hiding in the pile.',
				measure: 3,
			},
		]);
	});

	test('restates the cap it was given, so a configured cap reads back the number in force', async () => {
		const input = setupFileListInput({ files: Array.from({ length: 21 }, (_, index) => `src/wide/wide${index}.ts`) });

		const findings = await check.run({ inputs: { 'file-list': input }, options: { cap: 20 } });

		expect(findings.map(({ detail }) => detail)).toStrictEqual(['21 files in one flat folder (cap ~20)']);
	});

	test('measures each folder against the cap option', async () => {
		const input = setupFileListInput({ files: ['src/wide/a.ts', 'src/wide/b.ts', 'src/wide/c.ts'] });

		const [findingsAtCapTwo, findingsAtCapThree] = await Promise.all([
			check.run({ inputs: { 'file-list': input }, options: { cap: 2 } }),
			check.run({ inputs: { 'file-list': input }, options: { cap: 3 } }),
		]);

		expect({ findingsAtCapTwo, findingsAtCapThree }).toStrictEqual({
			findingsAtCapTwo: [
				{
					siteKey: 'folder-size:src/wide',
					files: [{ path: 'src/wide' }],
					detail: '3 files in one flat folder (cap ~2)',
					guidance: 'Group them by domain, or graduate the concepts hiding in the pile.',
					measure: 3,
				},
			],
			findingsAtCapThree: [],
		});
	});

	test('reports nothing when its input is missing rather than refusing', async () => {
		const findings = await check.run({ inputs: {}, options: { cap: 3 } });

		expect(findings).toStrictEqual([]);
	});

	test('reports the counted file total as the measure, excluding what the count already excludes', async () => {
		const input = setupFileListInput({
			files: [
				'src/wide/a.ts',
				'src/wide/b.ts',
				'src/wide/c.ts',
				'src/wide/d.ts',
				'src/wide/e.ts',
				'src/wide/f.ts',
				'src/a.ts',
				'src/b.ts',
				'src/c.ts',
				'src/d.ts',
				'src/e.ts',
			],
		});

		const findings = await check.run({ inputs: { 'file-list': input }, options: { cap: 3 } });

		expect(findings.map(({ siteKey, measure }) => ({ siteKey, measure }))).toStrictEqual([
			{ siteKey: 'folder-size:src/wide', measure: 6 },
			{ siteKey: 'folder-size:src', measure: 5 },
		]);
	});
});
