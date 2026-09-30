import { mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from '@jest/globals';
import type { StandardsCheckInput } from '@lightsout/standards-contracts';
import { StandardsInputKind } from '@lightsout/standards-contracts';
import { StandardsSeverity } from '#src/contracts/standardsCheck/StandardsSeverity.ts';
import { RuleExampleKind } from '#src/contracts/views/RuleExampleKind.ts';
import { parseRuleFolder } from '#src/standardsLibraries/internal/common/parsing/parseRuleFolder.ts';

/** One rule folder on disk, declaring the given front matter, with nothing else in it. */
const setupRuleFolder = ({ frontMatter }: { frontMatter: string }) => {
	const folderPath = join(mkdtempSync(join(tmpdir(), 'lightsout-rule-')), '01-internal-import-from-outside');

	mkdirSync(folderPath, { recursive: true });
	writeFileSync(join(folderPath, 'rule.md'), `---\n${frontMatter}\n---\n\nPrivate files live in internal/.\n`);

	return { folderPath };
};

/** One rule folder on disk under the given folder name, declaring only a summary. */
const setupNamedRuleFolder = ({ folderName }: { folderName: string }) => {
	const folderPath = join(mkdtempSync(join(tmpdir(), 'lightsout-rule-')), folderName);

	mkdirSync(folderPath, { recursive: true });
	writeFileSync(join(folderPath, 'rule.md'), '---\nsummary: a file past its size cap\n---\n\nKeep files small.\n');

	return { folderPath };
};

/** A checked rule's front matter: what makes the loader look for a check file. */
const checkedRuleMarkdown = '---\nsummary: a source file outside a module\nchecked: true\n---\n\nKeep files in modules.\n';

/** A valid check written as a TypeScript author writes one: one finding per file it is handed. */
const checkTsSource =
	'export const check = {\n' +
	"\tinputKind: 'file-list',\n" +
	'\trun: ({ input }) => input.files.map((path) => ({ siteKey: `loose-file:${path}`, files: [{ path }], detail: `${path} sits outside a module` })),\n' +
	'};\n';

/** The same check compiled to plain JavaScript, as a library published to npm ships it. */
const checkJsSource =
	'exports.check = {\n' +
	"\tinputKind: 'file-list',\n" +
	'\trun: ({ input }) => input.files.map((path) => ({ siteKey: `loose-file:${path}`, files: [{ path }], detail: `${path} sits outside a module (js)` })),\n' +
	'};\n';

/** The engine-built input a file-list check reads — only `files` is what the checks above look at. */
const fileListInput = ({ files }: { files: string[] }): StandardsCheckInput => ({
	kind: StandardsInputKind.FileList,
	cwd: '/repo',
	source: files,
	tests: [],
	files,
	referenceFiles: [],
	dependencies: new Map(),
	standardsLibraries: [],
});

/** One checked rule folder on disk under `<root>/<libraryPath>/code/style/01-loose-file`, holding the given check files. */
const writeCheckedRule = ({ root, libraryPath, checkFiles }: { root: string; libraryPath: string; checkFiles: Record<string, string> }) => {
	const folderPath = join(root, libraryPath, 'code/style/01-loose-file');

	mkdirSync(folderPath, { recursive: true });
	writeFileSync(join(root, libraryPath, 'lightsout-standards.json'), '{ "name": "acme", "formatVersion": 1 }\n');
	writeFileSync(join(folderPath, 'rule.md'), checkedRuleMarkdown);

	for (const [fileName, content] of Object.entries(checkFiles)) {
		writeFileSync(join(folderPath, fileName), content);
	}

	return folderPath;
};

/** A checked rule folder in a fresh temp library, holding the given check files. */
const setupCheckedRuleFolder = ({ checkFiles }: { checkFiles: Record<string, string> }) => {
	const root = mkdtempSync(join(tmpdir(), 'lightsout-rule-'));
	const folderPath = writeCheckedRule({ root, libraryPath: 'acme', checkFiles });

	return { folderPath };
};

/**
 * Two copies of one library: one installed under `node_modules/acme` whose
 * check.ts throws if it is ever imported, and one whose source lives outside
 * `node_modules` and is reached through a `node_modules` symlink, as a
 * workspace-linked library is.
 */
const setupNodeModulesLibraries = () => {
	const installedRoot = mkdtempSync(join(tmpdir(), 'lightsout-installed-'));
	const installedFolderPath = writeCheckedRule({
		root: installedRoot,
		libraryPath: 'node_modules/acme',
		checkFiles: { 'check.ts': "throw new Error('this check was imported from node_modules');\n" },
	});
	const linkedRoot = mkdtempSync(join(tmpdir(), 'lightsout-linked-'));

	writeCheckedRule({ root: linkedRoot, libraryPath: 'libraries/acme', checkFiles: { 'check.ts': checkTsSource } });
	mkdirSync(join(linkedRoot, 'node_modules'), { recursive: true });
	symlinkSync(join(linkedRoot, 'libraries/acme'), join(linkedRoot, 'node_modules/acme'), 'dir');
	const linkedFolderPath = join(linkedRoot, 'node_modules/acme/code/style/01-loose-file');

	return { installedFolderPath, linkedFolderPath };
};

/** Parses one rule folder of library acme, returning the rule and the problems recorded against it. */
const parseCollecting = async ({ folderPath }: { folderPath: string }) => {
	const problems: string[] = [];
	const rule = await parseRuleFolder({ folderPath, set: 'code', documentPath: 'code/style', library: 'acme', problems });

	return { rule, problems };
};

/** Parses each rule folder in turn, in the order given. */
const parseEach = async ({ folderPaths }: { folderPaths: string[] }) => {
	const results: Awaited<ReturnType<typeof parseCollecting>>[] = [];

	for (const folderPath of folderPaths) {
		results.push(await parseCollecting({ folderPath }));
	}

	return results;
};

describe('parseRuleFolder', () => {
	test('reads a rule the pack ships off, for a repo to opt into', async () => {
		const { folderPath } = setupRuleFolder({ frontMatter: 'summary: an internal file imported from outside\nseverity: off' });
		const problems: string[] = [];

		const rule = await parseRuleFolder({ folderPath, set: 'code', documentPath: 'code/modules', library: 'acme', problems });

		expect({ id: rule?.id, defaultSeverity: rule?.defaultSeverity, problems }).toStrictEqual({
			id: 'internal-import-from-outside',
			defaultSeverity: StandardsSeverity.Off,
			problems: [],
		});
	});

	test('defaults a rule that states no severity to advisory', async () => {
		const { folderPath } = setupRuleFolder({ frontMatter: 'summary: an internal file imported from outside' });

		const rule = await parseRuleFolder({ folderPath, set: 'code', documentPath: 'code/modules', library: 'acme', problems: [] });

		expect(rule?.defaultSeverity).toBe(StandardsSeverity.Advisory);
	});

	test('refuses a severity the pack format does not know, and drops the rule', async () => {
		const { folderPath } = setupRuleFolder({ frontMatter: 'summary: an internal file imported from outside\nseverity: loud' });
		const problems: string[] = [];

		const rule = await parseRuleFolder({ folderPath, set: 'code', documentPath: 'code/modules', library: 'acme', problems });

		expect({ rule, problemCount: problems.length }).toStrictEqual({ rule: undefined, problemCount: 1 });
	});

	test('reads the example shape a rule declares, with the file each side opens on', async () => {
		const { folderPath } = setupRuleFolder({
			frontMatter: 'summary: an internal file imported from outside\nexample:\n  kind: repo\n  focus:\n    fail: src/a.ts\n    pass: src/b.ts',
		});

		const rule = await parseRuleFolder({ folderPath, set: 'code', documentPath: 'code/modules', library: 'acme', problems: [] });

		expect(rule?.example).toStrictEqual({ kind: RuleExampleKind.Repo, focus: { fail: 'src/a.ts', pass: 'src/b.ts' } });
	});

	test('leaves the example undeclared when rule.md says nothing, so the files decide', async () => {
		const { folderPath } = setupRuleFolder({ frontMatter: 'summary: an internal file imported from outside' });

		const rule = await parseRuleFolder({ folderPath, set: 'code', documentPath: 'code/modules', library: 'acme', problems: [] });

		expect(rule).not.toHaveProperty('example');
	});

	test('refuses a repo example that names no file to open on, and drops the rule', async () => {
		const { folderPath } = setupRuleFolder({ frontMatter: 'summary: an internal file imported from outside\nexample:\n  kind: repo' });
		const problems: string[] = [];

		const rule = await parseRuleFolder({ folderPath, set: 'code', documentPath: 'code/modules', library: 'acme', problems });

		expect({ rule, problemCount: problems.length }).toStrictEqual({ rule: undefined, problemCount: 1 });
	});

	test.each([
		{ frontMatter: 'summary: an internal file imported from outside\noptions:\n  cap: 12', expected: { cap: 12 } },
		{ frontMatter: 'summary: an internal file imported from outside', expected: {} },
	])('reads the numbers a rule declares under options as its default options', async ({ frontMatter, expected }) => {
		const { folderPath } = setupRuleFolder({ frontMatter });

		const rule = await parseRuleFolder({ folderPath, set: 'code', documentPath: 'code/modules', library: 'acme', problems: [] });

		expect(rule?.defaultOptions).toStrictEqual(expected);
	});

	test('refuses an option that is not a number, and drops the rule', async () => {
		const { folderPath } = setupRuleFolder({ frontMatter: 'summary: an internal file imported from outside\noptions:\n  cap: soon' });
		const problems: string[] = [];

		const rule = await parseRuleFolder({ folderPath, set: 'code', documentPath: 'code/modules', library: 'acme', problems });

		expect({ rule, problems }).toEqual({
			rule: undefined,
			problems: [expect.stringContaining('code/modules/01-internal-import-from-outside/rule.md')],
		});
	});

	test('a rule parsed for library acme carries the full name acme/size and its library', async () => {
		const { folderPath } = setupNamedRuleFolder({ folderName: '03-size' });

		const rule = await parseRuleFolder({ folderPath, set: 'code', documentPath: 'code/modules', library: 'acme', problems: [] });

		expect({ id: rule?.id, library: rule?.library, name: rule?.name }).toStrictEqual({
			id: 'size',
			library: 'acme',
			name: 'acme/size',
		});
	});

	test('parseRuleFolder loads a rule whose check ships as check.js', async () => {
		const { folderPath } = setupCheckedRuleFolder({ checkFiles: { 'check.js': checkJsSource } });

		const { rule, problems } = await parseCollecting({ folderPath });
		const findings = await rule?.run?.({ input: fileListInput({ files: ['src/alpha.ts'] }), options: {} });

		expect({ problems, inputKind: rule?.inputKind, findings }).toStrictEqual({
			problems: [],
			inputKind: 'file-list',
			findings: [{ siteKey: 'loose-file:src/alpha.ts', files: [{ path: 'src/alpha.ts' }], detail: 'src/alpha.ts sits outside a module (js)' }],
		});
	});

	test('parseRuleFolder demands exactly one of check.ts or check.js', async () => {
		const both = setupCheckedRuleFolder({ checkFiles: { 'check.ts': checkTsSource, 'check.js': checkJsSource } });
		const neither = setupCheckedRuleFolder({ checkFiles: {} });

		const [withBoth, withNeither] = await parseEach({ folderPaths: [both.folderPath, neither.folderPath] });

		expect({ withBoth, withNeither }).toEqual({
			withBoth: {
				rule: undefined,
				problems: [expect.stringMatching(/^code\/style\/01-loose-file: .*check\.ts.*check\.js|^code\/style\/01-loose-file: .*check\.js.*check\.ts/)],
			},
			withNeither: {
				rule: undefined,
				problems: [expect.stringMatching(/^code\/style\/01-loose-file: .*check\.ts.*check\.js|^code\/style\/01-loose-file: .*check\.js.*check\.ts/)],
			},
		});
	});

	test('parseRuleFolder refuses a check.ts whose real path is under node_modules and names check.js', async () => {
		const { installedFolderPath, linkedFolderPath } = setupNodeModulesLibraries();

		const [installed, linked] = await parseEach({ folderPaths: [installedFolderPath, linkedFolderPath] });

		expect({
			installedRule: installed?.rule,
			installedProblems: installed?.problems,
			linkedProblems: linked?.problems,
			linkedInputKind: linked?.rule?.inputKind,
		}).toEqual({
			installedRule: undefined,
			installedProblems: [
				expect.stringMatching(/^(?=.*code\/style\/01-loose-file)(?=.*check\.ts)(?=.*node_modules)(?=.*check\.js)(?!.*imported from node_modules)/),
			],
			linkedProblems: [],
			linkedInputKind: 'file-list',
		});
	});

	test('parseRuleFolder names the check file it imported when its export is invalid', async () => {
		const { folderPath } = setupCheckedRuleFolder({ checkFiles: { 'check.js': 'exports.check = 5;\n' } });

		const { rule, problems } = await parseCollecting({ folderPath });

		expect({ rule, problems }).toEqual({
			rule: undefined,
			problems: [expect.stringMatching(/^(?=.*check\.js must export)(?!.*check\.ts)/)],
		});
	});
});
