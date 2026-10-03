import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, test } from '@jest/globals';
import type { FileListInput } from '@lightsout/standards-contracts';
import { StandardsInputKind } from '@lightsout/standards-contracts';
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

/**
 * The check a rule ships, written the way a pack author writes one: a `check`
 * export naming its input kind, and one finding per file it is handed.
 */
const checkSource =
	'export const check = {\n' +
	"\tinputKinds: ['file-list'],\n" +
	'\trun: ({ inputs }) => inputs["file-list"].files.map((path) => ({ siteKey: `loose-file:${path}`, files: [{ path }], detail: `${path} sits outside a module` })),\n' +
	'};\n';

/** The engine-built input a file-list check reads — only `files` is what the check above looks at. */
const fileListInput = ({ files }: { files: string[] }): FileListInput => ({
	kind: StandardsInputKind.FileList,
	cwd: '/repo',
	source: files,
	tests: [],
	files,
	referenceFiles: [],
	dependencies: new Map(),
	standardsLibraries: [],
});

describe('readStandardsLibrary checks', () => {
	test('loads the check a declared rule ships, carrying the input kind it asked for and the function itself', async () => {
		const { packPath } = setupPack({
			files: {
				...rootFile,
				'rules/code/style/topic.md': '# Style\n',
				...ruleFiles({
					path: 'rules/code/style/01-loose-file',
					markdown: '---\nsummary: a source file outside a module\nchecks: deterministic\n---\n\nProse.\n',
				}),
				'rules/code/style/01-loose-file/check.ts': checkSource,
			},
		});

		const pkg = await readStandardsLibrary({ packPath });
		const looseFile = pkg.rules.find((rule) => rule.id === 'loose-file');
		const findings = await looseFile?.run?.({ inputs: { 'file-list': fileListInput({ files: ['src/alpha.ts'] }) }, options: {} });

		// the declaration is honest, so the rule carries the kind its check asked for
		expect(looseFile?.deterministic).toBe(true);
		expect(looseFile?.inputKinds).toStrictEqual(['file-list']);
		// the function on the rule is the pack's own — what it returns is what a run would see
		expect(findings).toStrictEqual([{ siteKey: 'loose-file:src/alpha.ts', files: [{ path: 'src/alpha.ts' }], detail: 'src/alpha.ts sits outside a module' }]);
	});

	test('reports a rule whose check.ts exports no usable check, and drops the rule', async () => {
		const { packPath } = setupPack({
			files: {
				...rootFile,
				'rules/code/style/topic.md': '# Style\n',
				...ruleFiles({ path: 'rules/code/style/01-bad-check', markdown: '---\nsummary: ships a check it cannot load\nchecks: deterministic\n---\n\nProse.\n' }),
				'rules/code/style/01-bad-check/check.ts': 'export const check = 5;\n',
			},
		});

		const error = await getRejectionError({ promise: readStandardsLibrary({ packPath }) });

		// the rule folder is named alongside the file the author has to open
		expect(error.message).toContain('code/style/01-bad-check: check.ts must export `check` as { inputKinds, run }');
		expect(error.message).toContain(join(packPath, 'rules/code/style/01-bad-check/check.ts'));
	});

	test('reports a rule whose check.ts cannot be imported at all', async () => {
		const { packPath } = setupPack({
			files: {
				...rootFile,
				'rules/code/style/topic.md': '# Style\n',
				...ruleFiles({
					path: 'rules/code/style/01-throwing-check',
					markdown: '---\nsummary: ships a check that fails on import\nchecks: deterministic\n---\n\nProse.\n',
				}),
				'rules/code/style/01-throwing-check/check.ts': "throw new Error('this check cannot initialise');\n",
			},
		});

		const error = await getRejectionError({ promise: readStandardsLibrary({ packPath }) });

		// an import that blows up is the rule's fault to report, never the loader's to crash on
		expect(error.message).toContain('code/style/01-throwing-check: this check cannot initialise');
	});
});
