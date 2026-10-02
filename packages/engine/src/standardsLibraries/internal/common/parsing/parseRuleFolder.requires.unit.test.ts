import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from '@jest/globals';
import { parseRuleFolder } from '#src/standardsLibraries/internal/common/parsing/parseRuleFolder.ts';

/** One rule folder on disk under the given folder name, declaring the given front matter. */
const writeRuleFolder = ({ folderName, frontMatter }: { folderName: string; frontMatter: string }) => {
	const folderPath = join(mkdtempSync(join(tmpdir(), 'lightsout-rule-')), folderName);

	mkdirSync(folderPath, { recursive: true });
	writeFileSync(join(folderPath, 'rule.md'), `---\n${frontMatter}\n---\n\nFollow the folder rules this rule points at.\n`);

	return folderPath;
};

/**
 * Two rule folders: one whose requires is a block list holding a short id and
 * a full name, and one whose requires is a bare string rather than a list.
 */
const setupRequiresFolders = () => {
	const listFolderPath = writeRuleFolder({
		folderName: '10-component-file-structure',
		frontMatter: 'summary: a component file laid out outside its folder\nrequires:\n  - folder-index-file\n  - house/module-folder-layout',
	});
	const bareStringFolderPath = writeRuleFolder({
		folderName: '20-shared-folder-layout',
		frontMatter: 'summary: a domain folder holding loose files\nrequires: folder-index-file',
	});

	return { listFolderPath, bareStringFolderPath };
};

/** Parses each rule folder of library acme in turn, returning each rule with the problems recorded against it. */
const parseEach = async ({ folderPaths }: { folderPaths: string[] }) => {
	const results: Array<{ rule: Awaited<ReturnType<typeof parseRuleFolder>>; problems: string[] }> = [];

	for (const folderPath of folderPaths) {
		const problems: string[] = [];
		const rule = await parseRuleFolder({ folderPath, set: 'code', documentPath: 'code/architecture/react', library: 'acme', problems });

		results.push({ rule, problems });
	}

	return results;
};

describe('parseRuleFolder', () => {
	test('carries rule.md requires entries as written and rejects a requires value that is not a list', async () => {
		const { listFolderPath, bareStringFolderPath } = setupRequiresFolders();

		const [withList, withBareString] = await parseEach({ folderPaths: [listFolderPath, bareStringFolderPath] });

		expect({
			listRequires: withList?.rule?.requires,
			listProblems: withList?.problems,
			bareStringRule: withBareString?.rule,
			bareStringProblems: withBareString?.problems,
		}).toEqual({
			listRequires: ['folder-index-file', 'house/module-folder-layout'],
			listProblems: [],
			bareStringRule: undefined,
			bareStringProblems: [expect.stringContaining('code/architecture/react/20-shared-folder-layout/rule.md')],
		});
	});
});
