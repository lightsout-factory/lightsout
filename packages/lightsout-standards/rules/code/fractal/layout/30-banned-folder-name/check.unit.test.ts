import { describe, expect, test } from '@jest/globals';
import { setupFileListInput } from '@lightsout/standards-testkit';
import { check } from './check.ts';

describe('banned-folder-name check', () => {
	test('asks for the file list alone, since a folder name is read from its path', () => {
		expect(check.inputKinds).toStrictEqual(['file-list']);
	});

	test('reports a folder named for the kind of code it holds', async () => {
		const input = setupFileListInput({ files: ['src/billing/helpers/formatAmount.ts'] });

		const findings = await check.run({ inputs: { 'file-list': input }, options: {} });

		expect(findings).toStrictEqual([
			{
				siteKey: 'banned-folder-name:src/billing/helpers',
				files: [{ path: 'src/billing/helpers' }],
				detail: "folder 'helpers' is named for the kind of code it holds",
				guidance: 'Name the folder for its subject, or move its files beside the code that uses them.',
			},
		]);
	});

	test('names every folder on the closed list, restated here so a name dropped from it stops enforcing loudly', async () => {
		const input = setupFileListInput({
			files: [
				'src/tier/utils/a.ts',
				'src/tier/services/b.ts',
				'src/tier/helpers/c.ts',
				'src/tier/lib/d.ts',
				'src/tier/core/e.ts',
				'src/tier/misc/f.ts',
				'src/tier/shared/g.ts',
				'src/tier/internal/h.ts',
			],
		});

		const findings = await check.run({ inputs: { 'file-list': input }, options: {} });

		expect(findings.map(({ siteKey }) => siteKey)).toStrictEqual([
			'banned-folder-name:src/tier/core',
			'banned-folder-name:src/tier/helpers',
			'banned-folder-name:src/tier/internal',
			'banned-folder-name:src/tier/lib',
			'banned-folder-name:src/tier/misc',
			'banned-folder-name:src/tier/services',
			'banned-folder-name:src/tier/shared',
			'banned-folder-name:src/tier/utils',
		]);
	});

	test('bans a listed name under a common/ too, since those names are wrong at every level', async () => {
		const input = setupFileListInput({ files: ['src/mod/common/utils/n.ts', 'src/mod/common/helpers/o.ts'] });

		const findings = await check.run({ inputs: { 'file-list': input }, options: {} });

		expect(findings.map(({ siteKey }) => siteKey)).toStrictEqual(['banned-folder-name:src/mod/common/helpers', 'banned-folder-name:src/mod/common/utils']);
	});

	test('leaves types/ and constants/ alone at the top of a common/', async () => {
		const input = setupFileListInput({ files: ['src/mod/common/types/P.ts', 'src/mod/common/constants/q.ts', 'src/common/types/R.ts'] });

		const findings = await check.run({ inputs: { 'file-list': input }, options: {} });

		expect(findings).toStrictEqual([]);
	});

	test('reports types/ and constants/ anywhere else, a folder deeper inside a common/ included', async () => {
		const input = setupFileListInput({ files: ['src/tier/types/L.ts', 'src/tier/constants/m.ts', 'src/mod/common/parsing/types/N.ts'] });

		const findings = await check.run({ inputs: { 'file-list': input }, options: {} });

		expect(findings.map(({ siteKey, detail, guidance }) => ({ siteKey, detail, guidance }))).toStrictEqual([
			{
				siteKey: 'banned-folder-name:src/mod/common/parsing/types',
				detail: "folder 'types' sits outside the top of a common/",
				guidance: 'Move its files to the `types/` or `constants/` at the top of the `common/` that serves their users.',
			},
			{
				siteKey: 'banned-folder-name:src/tier/constants',
				detail: "folder 'constants' sits outside the top of a common/",
				guidance: 'Move its files to the `types/` or `constants/` at the top of the `common/` that serves their users.',
			},
			{
				siteKey: 'banned-folder-name:src/tier/types',
				detail: "folder 'types' sits outside the top of a common/",
				guidance: 'Move its files to the `types/` or `constants/` at the top of the `common/` that serves their users.',
			},
		]);
	});

	test("judges only paths inside a package's source tree, never the repo's own test and script trees", async () => {
		const input = setupFileListInput({ files: ['src/helpers/a.ts', 'tests/helpers/b.ts', 'scripts/lib/c.ts'] });

		const findings = await check.run({ inputs: { 'file-list': input }, options: {} });

		expect(findings.map(({ siteKey }) => siteKey)).toStrictEqual(['banned-folder-name:src/helpers']);
	});

	test('anchors per package: each workspace package is judged inside its own src/', async () => {
		const input = setupFileListInput({
			files: ['packages/api/src/billing/helpers/a.ts', 'packages/api/tests/helpers/b.ts'],
			dependencies: [['packages/api', []]],
		});

		const findings = await check.run({ inputs: { 'file-list': input }, options: {} });

		expect(findings.map(({ siteKey }) => siteKey)).toStrictEqual(['banned-folder-name:packages/api/src/billing/helpers']);
	});

	test('reports each banned folder once however many files it holds, in path order', async () => {
		const input = setupFileListInput({ files: ['src/b/lib/one.ts', 'src/b/lib/two.ts', 'src/a/core/three.ts'] });

		const findings = await check.run({ inputs: { 'file-list': input }, options: {} });

		expect(findings.map(({ siteKey }) => siteKey)).toStrictEqual(['banned-folder-name:src/a/core', 'banned-folder-name:src/b/lib']);
	});

	test('reports nothing when its input is missing rather than refusing', async () => {
		const findings = await check.run({ inputs: {}, options: {} });

		expect(findings).toStrictEqual([]);
	});
});
