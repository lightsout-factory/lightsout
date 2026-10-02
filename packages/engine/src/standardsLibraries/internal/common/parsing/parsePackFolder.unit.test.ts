import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from '@jest/globals';
import { parsePackFolder } from '#src/standardsLibraries/internal/common/parsing/parsePackFolder.ts';

/** A library folder on disk whose `packs/` folder holds the given files; no `packs/` folder when `files` is undefined. */
const setupPackFolder = ({ files, folders = [] }: { files?: Record<string, string>; folders?: string[] } = {}) => {
	const libraryPath = mkdtempSync(join(tmpdir(), 'lightsout-packs-'));
	const folderPath = join(libraryPath, 'packs');

	if (files !== undefined) {
		mkdirSync(folderPath, { recursive: true });

		for (const [fileName, text] of Object.entries(files)) {
			writeFileSync(join(folderPath, fileName), text);
		}

		for (const folderName of folders) {
			mkdirSync(join(folderPath, folderName), { recursive: true });
			writeFileSync(join(folderPath, folderName, 'inner.json'), JSON.stringify({ description: 'Never read.' }));
		}
	}

	return { folderPath };
};

describe('parsePackFolder', () => {
	test('parsePackFolder returns no packs and no problem when the folder is missing', async () => {
		const { folderPath } = setupPackFolder();
		const problems: string[] = [];

		const packs = await parsePackFolder({ folderPath, problems });

		expect({ packs, problems }).toStrictEqual({ packs: [], problems: [] });
	});

	test('parsePackFolder returns valid pack files sorted by name with defaults filled in', async () => {
		const { folderPath } = setupPackFolder({
			files: {
				'zeta.json': JSON.stringify({
					description: 'Zeta pack.',
					include: { packs: ['lightsout/node'] },
					'rule-settings': { size: 'blocking', 'function-length': { options: { cap: 40 } } },
				}),
				'alpha.json': JSON.stringify({ description: 'Alpha pack.' }),
			},
		});
		const problems: string[] = [];

		const packs = await parsePackFolder({ folderPath, problems });

		expect({ packs, problems }).toStrictEqual({
			packs: [
				{
					name: 'alpha',
					filePath: 'packs/alpha.json',
					description: 'Alpha pack.',
					include: { packs: [], topics: [], rules: [] },
					ruleSettings: {},
					appliesWhen: undefined,
				},
				{
					name: 'zeta',
					filePath: 'packs/zeta.json',
					description: 'Zeta pack.',
					include: { packs: ['lightsout/node'], topics: [], rules: [] },
					ruleSettings: { size: 'blocking', 'function-length': { options: { cap: 40 } } },
					appliesWhen: undefined,
				},
			],
			problems: [],
		});
	});

	test("parsePackFolder reads a pack file's applies-when as the dependencies the pack is conditional on", async () => {
		const { folderPath } = setupPackFolder({
			files: {
				'react.json': JSON.stringify({ description: 'React pack.', 'applies-when': { dependencies: ['react', 'preact'] } }),
			},
		});
		const problems: string[] = [];

		const packs = await parsePackFolder({ folderPath, problems });

		expect({ packs, problems }).toStrictEqual({
			packs: [
				{
					name: 'react',
					filePath: 'packs/react.json',
					description: 'React pack.',
					include: { packs: [], topics: [], rules: [] },
					ruleSettings: {},
					appliesWhen: { dependencies: ['react', 'preact'] },
				},
			],
			problems: [],
		});
	});

	test('parsePackFolder reports an applies-when with no dependency or an unknown key, each by path, and keeps the valid sibling', async () => {
		const { folderPath } = setupPackFolder({
			files: {
				'empty.json': JSON.stringify({ description: 'Conditional on nothing.', 'applies-when': { dependencies: [] } }),
				'unknown.json': JSON.stringify({ description: 'Has an unknown condition.', 'applies-when': { dependencies: ['react'], files: ['vite.config.ts'] } }),
				'valid.json': JSON.stringify({ description: 'Valid pack.', 'applies-when': { dependencies: ['react'] } }),
			},
		});
		const problems: string[] = [];

		const packs = await parsePackFolder({ folderPath, problems });

		expect({ names: packs.map((pack) => pack.name), problems: [...problems].sort() }).toEqual({
			names: ['valid'],
			problems: [expect.stringMatching(/^packs\/empty\.json: .*applies-when/), expect.stringMatching(/^packs\/unknown\.json: .*applies-when/)],
		});
	});

	test('parsePackFolder reports each bad pack file by path and keeps its valid siblings', async () => {
		const { folderPath } = setupPackFolder({
			files: {
				'broken.json': '{ "description": ',
				'shapeless.json': JSON.stringify({ description: 'Has an unknown key.', extends: ['lightsout/node'] }),
				'valid.json': JSON.stringify({ description: 'Valid pack.', include: { topics: ['lightsout/tests/unit-testing'] } }),
			},
		});
		const problems: string[] = [];

		const packs = await parsePackFolder({ folderPath, problems });

		expect({ names: packs.map((pack) => pack.name), problems: [...problems].sort() }).toEqual({
			names: ['valid'],
			problems: [expect.stringContaining('packs/broken.json'), expect.stringContaining('packs/shapeless.json')],
		});
	});

	test('parsePackFolder skips every entry that is not a .json file', async () => {
		const { folderPath } = setupPackFolder({
			files: {
				'.DS_Store': '\u0000\u0001not json',
				'README.md': '# Packs\n\nOne file per pack.\n',
				'node.json': JSON.stringify({ description: 'Node pack.' }),
			},
			folders: ['drafts'],
		});
		const problems: string[] = [];

		const packs = await parsePackFolder({ folderPath, problems });

		expect({ names: packs.map((pack) => pack.name), problems }).toStrictEqual({ names: ['node'], problems: [] });
	});
});
