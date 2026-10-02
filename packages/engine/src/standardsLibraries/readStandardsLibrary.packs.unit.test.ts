import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, test } from '@jest/globals';
import { readStandardsLibrary } from '#src/standardsLibraries/readStandardsLibrary.ts';
import { getRejectionError } from '#tests/helpers/getRejectionError.ts';

/** A temp standards library holding the given library-relative files. */
const writeLibrary = ({ files }: { files: Record<string, string> }) => {
	const packPath = mkdtempSync(join(tmpdir(), 'lightsout-library-'));

	for (const [path, content] of Object.entries(files)) {
		const absolutePath = join(packPath, path);

		mkdirSync(dirname(absolutePath), { recursive: true });
		writeFileSync(absolutePath, content);
	}

	return packPath;
};

/** One rule folder's files: its markdown plus the fixture pair every rule ships. */
const ruleFiles = ({ path, markdown }: { path: string; markdown: string }) => ({
	[`${path}/rule.md`]: markdown,
	[`${path}/fixtures/pass/src/example.ts`]: 'export const example = 1;\n',
	[`${path}/fixtures/fail/src/example.ts`]: 'export const example = 2;\n',
});

/**
 * Two libraries: one whose topic and three pack files are all valid, one of
 * them conditional, and one holding a pack file that is not JSON and a pack
 * file conditional on nothing beside a rule with no summary — pack problems
 * and a topic problem the loader must report together.
 */
const setupLibraries = () => {
	const rootFile = { 'lightsout-standards.json': '{ "name": "acme", "formatVersion": 2 }\n' };
	const validPackPath = writeLibrary({
		files: {
			...rootFile,
			'rules/code/style/topic.md': '# Style\n',
			...ruleFiles({ path: 'rules/code/style/01-functions', markdown: '---\nsummary: one export per file\n---\n\nProse.\n' }),
			'packs/node.json': JSON.stringify({ description: 'Node pack.', include: { packs: ['acme/base'] } }),
			'packs/base.json': JSON.stringify({ description: 'Base pack.', include: { topics: ['acme/code/style'] }, 'rule-settings': { functions: 'blocking' } }),
			'packs/react.json': JSON.stringify({ description: 'React pack.', include: { packs: ['acme/base'] }, 'applies-when': { dependencies: ['react'] } }),
		},
	});
	const brokenPackPath = writeLibrary({
		files: {
			...rootFile,
			'rules/code/style/topic.md': '# Style\n',
			...ruleFiles({ path: 'rules/code/style/01-no-summary', markdown: '---\nchecked: false\n---\n\nProse.\n' }),
			'packs/broken.json': '{ "description": ',
			'packs/unconditional.json': JSON.stringify({ description: 'Conditional on nothing.', 'applies-when': { dependencies: [] } }),
			'packs/valid.json': JSON.stringify({ description: 'Valid pack.' }),
		},
	});

	return { validPackPath, brokenPackPath };
};

describe('readStandardsLibrary packs', () => {
	test('readStandardsLibrary loads packs and batches a bad pack file with the other load problems', async () => {
		const { validPackPath, brokenPackPath } = setupLibraries();

		const library = await readStandardsLibrary({ packPath: validPackPath });
		const error = await getRejectionError({ promise: readStandardsLibrary({ packPath: brokenPackPath }) });

		// the packs/ folder loads sorted by name, each list and the settings map defaulted when the file omits them,
		// and only the pack that wrote applies-when carries a condition
		expect(library.packs).toStrictEqual([
			{
				name: 'base',
				filePath: 'packs/base.json',
				description: 'Base pack.',
				include: { packs: [], topics: ['acme/code/style'], rules: [] },
				ruleSettings: { functions: 'blocking' },
				appliesWhen: undefined,
			},
			{
				name: 'node',
				filePath: 'packs/node.json',
				description: 'Node pack.',
				include: { packs: ['acme/base'], topics: [], rules: [] },
				ruleSettings: {},
				appliesWhen: undefined,
			},
			{
				name: 'react',
				filePath: 'packs/react.json',
				description: 'React pack.',
				include: { packs: ['acme/base'], topics: [], rules: [] },
				ruleSettings: {},
				appliesWhen: { dependencies: ['react'] },
			},
		]);
		// one error for the whole load, listing both bad pack files beside the topic's rule problem: ${error.message}
		expect({
			startsWithLoadFailure: error.message.startsWith(`standards pack failed to load (${brokenPackPath}):`),
			namesBadPackFile: error.message.includes('- packs/broken.json'),
			namesEmptyCondition: /- packs\/unconditional\.json: .*applies-when/.test(error.message),
			namesTopicProblem: error.message.includes('code/style/01-no-summary/rule.md: summary'),
			namesValidPackFile: error.message.includes('packs/valid.json'),
		}).toStrictEqual({
			startsWithLoadFailure: true,
			namesBadPackFile: true,
			namesEmptyCondition: true,
			namesTopicProblem: true,
			namesValidPackFile: false,
		});
	});
});
