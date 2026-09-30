import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, test } from '@jest/globals';
import { readStandardsLibrary } from '#src/standardsLibraries/readStandardsLibrary.ts';
import { getRejectionError } from '#tests/helpers/getRejectionError.ts';

/** A temp standards pack holding the given pack-relative files, plus any empty folders. */
const setupPack = ({ files = {}, folders = [] }: { files?: Record<string, string>; folders?: string[] } = {}) => {
	const packPath = mkdtempSync(join(tmpdir(), 'lightsout-pack-'));

	for (const folder of folders) {
		mkdirSync(join(packPath, folder), { recursive: true });
	}

	for (const [path, content] of Object.entries(files)) {
		const absolutePath = join(packPath, path);

		mkdirSync(dirname(absolutePath), { recursive: true });
		writeFileSync(absolutePath, content);
	}

	return { packPath };
};

/** The root file every valid pack carries. */
const rootFile = { 'lightsout-standards.json': '{ "name": "acme", "formatVersion": 2 }\n' };

/** One rule folder's files: its markdown plus the fixture pair every rule ships. */
const ruleFiles = ({ path, markdown }: { path: string; markdown: string }) => ({
	[`${path}/rule.md`]: markdown,
	[`${path}/fixtures/pass/src/example.ts`]: 'export const example = 1;\n',
	[`${path}/fixtures/fail/src/example.ts`]: 'export const example = 2;\n',
});

describe('readStandardsLibrary', () => {
	test('reads documents and their rules in folder order', async () => {
		const { packPath } = setupPack({
			files: {
				...rootFile,
				'rules/code/architecture/decisions/topic.md': '# Architecture Decisions\n\nUniversal decisions.\n',
				...ruleFiles({
					path: 'rules/code/architecture/decisions/02-graduation-rule',
					markdown: '---\nsummary: a concept earns its folder\nseverity: blocking\noptions:\n  maxFiles: 20\n---\n\nEvery concept starts as a file.\n',
				}),
				...ruleFiles({
					path: 'rules/code/architecture/decisions/01-module-boundaries',
					markdown: '---\nsummary: cross-module imports go through index.ts\n---\n\nA folder-module has a public API.\n',
				}),
				'rules/tests/unit-testing/topic.md': '# Unit Testing\n\nHow to write tests.\n',
				...ruleFiles({
					path: 'rules/tests/unit-testing/01-mock-prefix',
					markdown: '---\nsummary: mock variables carry a mock prefix\n---\n\nName mocks so they read as mocks.\n',
				}),
			},
		});

		const pkg = await readStandardsLibrary({ packPath });
		const decisions = pkg.documents.find((document) => document.path === 'code/architecture/decisions');
		const unitTesting = pkg.documents.find((document) => document.path === 'tests/unit-testing');
		const graduation = pkg.rules.find((rule) => rule.id === 'graduation-rule');
		const boundaries = pkg.rules.find((rule) => rule.id === 'module-boundaries');

		// the root file names the pack and the format it is written against
		expect(pkg.name).toBe('acme');
		expect(pkg.formatVersion).toBe(2);
		expect(pkg.rootPath).toBe(packPath);
		// both trees are walked
		expect(pkg.documents).toHaveLength(2);
		expect(decisions?.set).toBe('code');
		expect(unitTesting?.set).toBe('tests');
		// the numeric prefix orders assembly, not the id
		expect(decisions?.ruleIds).toStrictEqual(['module-boundaries', 'graduation-rule']);
		// the document's body is its intro
		expect(unitTesting?.intro).toBe('# Unit Testing\n\nHow to write tests.');
		// a rule carries its declaration and its full prose
		expect(graduation?.summary).toBe('a concept earns its folder');
		expect(graduation?.prose).toBe('Every concept starts as a file.');
		expect(graduation?.defaultSeverity).toBe('blocking');
		expect(graduation?.defaultOptions).toStrictEqual({ maxFiles: 20 });
		expect(graduation?.fixturesPath).toBe(join(packPath, 'rules/code/architecture/decisions/02-graduation-rule/fixtures'));
		// silence means judgment-only and advisory — the two defaults a rule need not restate
		expect(boundaries?.checked).toBe(false);
		expect(boundaries?.defaultSeverity).toBe('advisory');
		expect(boundaries?.defaultOptions).toStrictEqual({});
		// no check declared, so no check loaded
		expect(boundaries?.inputKind).toBe(undefined);
		expect(boundaries?.run).toBe(undefined);
	});

	test('every topic and rule a library loads carries the manifest name as its library', async () => {
		const { packPath } = setupPack({
			files: {
				...rootFile,
				'rules/code/architecture/decisions/topic.md': '# Architecture Decisions\n',
				...ruleFiles({
					path: 'rules/code/architecture/decisions/01-module-boundaries',
					markdown: '---\nsummary: cross-module imports go through index.ts\n---\n\nProse.\n',
				}),
				...ruleFiles({ path: 'rules/code/architecture/decisions/02-graduation-rule', markdown: '---\nsummary: a concept earns its folder\n---\n\nProse.\n' }),
				'rules/tests/unit-testing/topic.md': '# Unit Testing\n',
				...ruleFiles({ path: 'rules/tests/unit-testing/01-mock-prefix', markdown: '---\nsummary: mock variables carry a mock prefix\n---\n\nProse.\n' }),
			},
		});

		const pkg = await readStandardsLibrary({ packPath });

		// both trees and every rule under them are stamped with the root file's name, never another
		expect({
			topics: pkg.documents.map((topic) => [topic.path, topic.library]),
			rules: pkg.rules.map((rule) => [rule.id, rule.library]),
		}).toStrictEqual({
			topics: [
				['code/architecture/decisions', 'acme'],
				['tests/unit-testing', 'acme'],
			],
			rules: [
				['module-boundaries', 'acme'],
				['graduation-rule', 'acme'],
				['mock-prefix', 'acme'],
			],
		});
	});

	test('reads a pack authored with Windows line endings', async () => {
		const { packPath } = setupPack({
			files: {
				...rootFile,
				'rules/code/style/topic.md': '# Style\r\n',
				...ruleFiles({
					path: 'rules/code/style/01-functions',
					markdown: '---\r\nsummary: one export per file\r\nseverity: blocking\r\n---\r\n\r\nProse.\r\n',
				}),
			},
		});

		const pkg = await readStandardsLibrary({ packPath });
		const functions = pkg.rules.find((rule) => rule.id === 'functions');

		// a CRLF file declares exactly what the same LF file would — the markers are found and the prose starts after them
		expect(pkg.documents[0]?.intro).toBe('# Style');
		expect(functions?.summary).toBe('one export per file');
		expect(functions?.defaultSeverity).toBe('blocking');
		expect(functions?.prose).toBe('Prose.');
	});

	test('reports every structural and honesty problem in one error rather than the first', async () => {
		const { packPath } = setupPack({
			folders: ['rules/code/style/patterns/04-empty-fixtures/fixtures/pass'],
			files: {
				...rootFile,
				'rules/code/style/patterns/topic.md': '# Patterns\n',
				...ruleFiles({ path: 'rules/code/style/patterns/no-prefix', markdown: '---\nsummary: unordered\n---\n\nProse.\n' }),
				...ruleFiles({ path: 'rules/code/style/patterns/01-checked-without-check', markdown: '---\nsummary: claims a check\nchecked: true\n---\n\nProse.\n' }),
				...ruleFiles({ path: 'rules/code/style/patterns/02-stray-check', markdown: '---\nsummary: ships an undeclared check\n---\n\nProse.\n' }),
				'rules/code/style/patterns/02-stray-check/check.ts': 'export const check = { inputKind: "file-list", run: () => [] };\n',
				...ruleFiles({ path: 'rules/code/style/patterns/03-no-summary', markdown: '---\nchecked: false\n---\n\nProse.\n' }),
				'rules/code/style/patterns/04-empty-fixtures/rule.md': '---\nsummary: ships no fixtures\n---\n\nProse.\n',
				...ruleFiles({ path: 'rules/code/style/patterns/05-shared-id', markdown: '---\nsummary: first claimant\n---\n\nProse.\n' }),
				'rules/tests/unit-testing/topic.md': '# Unit Testing\n',
				...ruleFiles({ path: 'rules/tests/unit-testing/06-shared-id', markdown: '---\nsummary: second claimant\n---\n\nProse.\n' }),
			},
		});

		const error = await getRejectionError({ promise: readStandardsLibrary({ packPath }) });

		// one error, naming the pack and listing every fault: ${error.message}
		expect(error.message.startsWith(`standards pack failed to load (${packPath}):`)).toBeTruthy();
		expect(error.message).toContain('code/style/patterns/no-prefix: rule folder must be named <NN>-<rule-id>');
		expect(error.message).toContain('code/style/patterns/01-checked-without-check: declares checked: true but ships no check.ts');
		expect(error.message).toContain('code/style/patterns/02-stray-check: ships a check.ts but does not declare checked: true');
		expect(error.message).toContain('code/style/patterns/03-no-summary/rule.md: summary');
		expect(error.message).toContain('duplicate rule id "shared-id"');
		// 04-empty-fixtures ships none, and loading does not care: whether a check
		// proves itself against a fixture pair is what `standards-validate` asks.
		expect(error.message).not.toContain('fixture');
	});

	test('refuses a pack whose walk finds no document at all', async () => {
		const { packPath } = setupPack({ files: { ...rootFile, 'rules/code/style/README.md': '# not a document\n' } });

		const error = await getRejectionError({ promise: readStandardsLibrary({ packPath }) });

		// a pack with nothing to say is a wrong path or a broken tree, never an intent
		expect(error.message).toContain('pack declares no documents');
	});

	test('an authored pack carries no built marker — its fixtures are still beside its rules', async () => {
		const { packPath } = setupPack({
			files: { ...rootFile, 'rules/code/architecture/decisions/topic.md': '# Architecture Decisions\n\nUniversal decisions.\n' },
		});

		const pkg = await readStandardsLibrary({ packPath });

		expect(pkg.built).toBeUndefined();
	});

	test('a pack the bundler stamped loads as built, which is how validate knows not to blame its rules', async () => {
		const { packPath } = setupPack({
			files: {
				'lightsout-standards.json': '{ "name": "acme", "formatVersion": 2, "built": true }\n',
				'rules/code/architecture/decisions/topic.md': '# Architecture Decisions\n\nUniversal decisions.\n',
			},
		});

		const pkg = await readStandardsLibrary({ packPath });

		expect(pkg.built).toBe(true);
	});

	test('refuses a pack whose root file is missing', async () => {
		const { packPath } = setupPack({ files: { 'rules/code/style/topic.md': '# Style\n' } });

		const error = await getRejectionError({ promise: readStandardsLibrary({ packPath }) });

		// the message names the file a reader has to open
		expect(error.message).toBe(`standards pack root file not found: ${join(packPath, 'lightsout-standards.json')}`);
	});

	test('refuses a pack whose root file will not parse', async () => {
		const { packPath } = setupPack({ files: { 'lightsout-standards.json': '{ "name": ' } });

		const error = await getRejectionError({ promise: readStandardsLibrary({ packPath }) });

		expect(error.message).toContain(`standards pack root file is not valid JSON (${join(packPath, 'lightsout-standards.json')})`);
	});

	test('refuses a pack written against another format version', async () => {
		const { packPath } = setupPack({ files: { 'lightsout-standards.json': '{ "name": "acme", "formatVersion": 1 }' } });

		const error = await getRejectionError({ promise: readStandardsLibrary({ packPath }) });

		expect(error.message).toContain(`standards pack root file is invalid (${join(packPath, 'lightsout-standards.json')})`);
		expect(error.message).toContain('formatVersion');
	});

	test('reports an unreadable document and a rule whose front matter is not YAML', async () => {
		const { packPath } = setupPack({
			folders: ['rules/code/unreadable/topic.md'],
			files: {
				...rootFile,
				'rules/code/style/topic.md': '# Style\n',
				...ruleFiles({ path: 'rules/code/style/01-broken-front-matter', markdown: '---\nsummary: {unclosed\n---\n\nProse.\n' }),
			},
		});

		const error = await getRejectionError({ promise: readStandardsLibrary({ packPath }) });

		// a directory named topic.md makes the folder look like a document it cannot read
		expect(error.message).toContain('code/unreadable/topic.md: unreadable');
		// malformed YAML quotes the line the author has to look at
		expect(error.message).toContain('code/style/01-broken-front-matter/rule.md: front matter is not valid YAML');
	});

	test('reports a document whose own front matter is not YAML', async () => {
		const { packPath } = setupPack({
			files: {
				...rootFile,
				'rules/code/style/topic.md': '---\ntitle: {unclosed\n---\n\n# Style\n',
				...ruleFiles({ path: 'rules/code/style/01-functions', markdown: '---\nsummary: one export per file\n---\n\nProse.\n' }),
			},
		});

		const error = await getRejectionError({ promise: readStandardsLibrary({ packPath }) });

		// the document is named alongside the line the author has to look at
		expect(error.message).toContain('code/style/topic.md: front matter is not valid YAML (starting "title: {unclosed")');
	});

	test('refuses a document whose front matter declares a key, dropping the document and the rules it owns', async () => {
		const { packPath } = setupPack({
			files: {
				...rootFile,
				'rules/code/style/topic.md': '---\ntitle: Style\n---\n\n# Style\n',
				...ruleFiles({ path: 'rules/code/style/01-functions', markdown: '---\nsummary: one export per file\n---\n\nProse.\n' }),
			},
		});

		const error = await getRejectionError({ promise: readStandardsLibrary({ packPath }) });

		// topic.md declares nothing, so a key there is refused by name rather than ignored
		expect(error.message).toMatch(/code\/style\/topic\.md: .*title/);
		// with the document dropped, its rules go too — nothing survives to be counted as a document
		expect(error.message).toContain('pack declares no documents');
	});

	test('treats a front matter block that is not a set of declarations as declaring nothing', async () => {
		const { packPath } = setupPack({
			files: {
				...rootFile,
				'rules/code/style/topic.md': '---\n- one\n- two\n---\n\n# Style\n',
				...ruleFiles({ path: 'rules/code/style/01-functions', markdown: '---\n- one\n- two\n---\n\nProse.\n' }),
			},
		});

		const error = await getRejectionError({ promise: readStandardsLibrary({ packPath }) });

		// a YAML list names no fields, so the document declares nothing and loads rather than failing
		expect(error.message).not.toContain('code/style/topic.md');
		// the same silence is fatal for a rule, whose summary has no default to fall back on
		expect(error.message).toContain('code/style/01-functions/rule.md: summary');
	});

	test('reports a rule whose rule.md cannot be read', async () => {
		const { packPath } = setupPack({
			folders: ['rules/code/style/01-unreadable/rule.md'],
			files: {
				...rootFile,
				'rules/code/style/topic.md': '# Style\n',
				'rules/code/style/01-unreadable/fixtures/pass/src/example.ts': 'export const example = 1;\n',
				'rules/code/style/01-unreadable/fixtures/fail/src/example.ts': 'export const example = 2;\n',
			},
		});

		const error = await getRejectionError({ promise: readStandardsLibrary({ packPath }) });

		// a directory named rule.md makes the folder look like a rule whose declaration cannot be read
		expect(error.message).toContain('code/style/01-unreadable/rule.md: unreadable — ');
	});

	test('walks past folders carrying no marker file and stops descending at a document', async () => {
		const { packPath } = setupPack({
			files: {
				...rootFile,
				'rules/code/common/utils/shared.ts': 'export const shared = 1;\n',
				'rules/code/style/topic.md': '# Style\n',
				'rules/code/style/common/helper.ts': 'export const helper = 1;\n',
				'rules/code/style/nested/topic.md': '# Nested\n',
				...ruleFiles({ path: 'rules/code/style/01-functions', markdown: '---\nsummary: one export per file\n---\n\nProse.\n' }),
			},
		});

		const pkg = await readStandardsLibrary({ packPath });

		// the pack's own helper folders are not documents, and a document's subtree holds only its rule folders
		expect(pkg.documents.map((document) => document.path)).toStrictEqual(['code/style']);
		expect(pkg.documents[0]?.ruleIds).toStrictEqual(['functions']);
		expect(pkg.rules.map((rule) => rule.id)).toStrictEqual(['functions']);
	});
});
