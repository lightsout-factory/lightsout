import { execSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, test } from '@jest/globals';
import { listSourceFiles } from '#src/common/sourceFiles/listSourceFiles.ts';

const setupRepo = ({ files, git = false, gitignore }: { files: string[]; git?: boolean; gitignore?: string }) => {
	const cwd = mkdtempSync(join(tmpdir(), 'lightsout-listsrc-'));

	for (const name of files) {
		mkdirSync(join(cwd, dirname(name)), { recursive: true });
		writeFileSync(join(cwd, name), 'export const one = 1;\n');
	}

	if (gitignore !== undefined) {
		writeFileSync(join(cwd, '.gitignore'), gitignore);
	}

	if (git) {
		execSync('git init -q && git add -A && git -c user.name=t -c user.email=t@t commit -qm init', { cwd });
	}

	return { cwd };
};

describe('listSourceFiles', () => {
	test('lists exactly what the source-files globs name, repo-relative and sorted, in any language', async () => {
		const { cwd } = setupRepo({
			files: ['src/b/second.tsx', 'src/a/first.ts', 'src/a/first.unit.test.ts', 'app/models/user.py', 'README.md', 'src/data.json'],
		});

		const { files } = await listSourceFiles({ cwd, sourceFileGlobs: ['src/**/*.{ts,tsx}', 'app/**/*.py'] });

		// tests are code too; test-files says which ones they are
		expect(files).toStrictEqual(['app/models/user.py', 'src/a/first.ts', 'src/a/first.unit.test.ts', 'src/b/second.tsx']);
	});

	test('holds no extension or folder of its own: with no globs, nothing is code', async () => {
		const { cwd } = setupRepo({ files: ['src/keep.ts'] });

		const { files } = await listSourceFiles({ cwd, sourceFileGlobs: [] });

		expect(files).toStrictEqual([]);
	});

	test('a ! glob excludes what it matches, outside a git repo too', async () => {
		const { cwd } = setupRepo({ files: ['src/keep.ts', 'src/types.d.ts', 'node_modules/pkg/index.ts'] });

		const { files } = await listSourceFiles({ cwd, sourceFileGlobs: ['**/*.ts', '!**/*.d.ts', '!**/node_modules/**'] });

		expect(files).toStrictEqual(['src/keep.ts']);
	});

	test('inside a git repo, a file the repo ignores is never listed, so no output folder needs naming', async () => {
		const { cwd } = setupRepo({ files: ['src/keep.ts', 'dist/bundle.ts', 'node_modules/pkg/index.ts'], gitignore: 'dist/\nnode_modules/\n', git: true });

		const { files } = await listSourceFiles({ cwd, sourceFileGlobs: ['**/*.ts'] });

		expect(files).toStrictEqual(['src/keep.ts']);
	});

	test('inside a git repo, an untracked file the repo does not ignore is listed, and a deleted tracked one is not', async () => {
		const { cwd } = setupRepo({ files: ['src/keep.ts', 'src/gone.ts'], git: true });

		writeFileSync(join(cwd, 'src/fresh.ts'), 'export const fresh = 1;\n');
		rmSync(join(cwd, 'src/gone.ts'));

		const { files } = await listSourceFiles({ cwd, sourceFileGlobs: ['**/*.ts'] });

		expect(files).toStrictEqual(['src/fresh.ts', 'src/keep.ts']);
	});

	test('a dot-folder is skipped unless a glob names it, as globs read everywhere', async () => {
		const { cwd } = setupRepo({ files: ['src/keep.ts', '.storybook/preview.ts'] });

		const plain = await listSourceFiles({ cwd, sourceFileGlobs: ['**/*.ts'] });
		const named = await listSourceFiles({ cwd, sourceFileGlobs: ['**/*.ts', '.storybook/**/*.ts'] });

		expect({ plain: plain.files, named: named.files }).toStrictEqual({ plain: ['src/keep.ts'], named: ['.storybook/preview.ts', 'src/keep.ts'] });
	});

	test('excluded prefixes are left out, with or without a trailing slash', async () => {
		const { cwd } = setupRepo({ files: ['src/keep.ts', 'src/generated/client.ts', 'vendor/ui/button.ts'] });

		const { files } = await listSourceFiles({ cwd, sourceFileGlobs: ['**/*.ts'], exclude: ['src/generated/', 'vendor/ui'] });

		expect(files).toStrictEqual(['src/keep.ts']);
	});

	test('a standards library is reported by its root, and its fixtures are never listed', async () => {
		const { cwd } = setupRepo({
			files: ['src/keep.ts', 'standards/rules/code/a/05-rule/check.ts', 'standards/rules/code/a/05-rule/fixtures/fail/src/bad.ts'],
		});

		writeFileSync(join(cwd, 'standards/lightsout-standards.json'), '{ "name": "acme", "formatVersion": 2 }\n');

		const { files, standardsLibraries } = await listSourceFiles({ cwd, sourceFileGlobs: ['**/*.ts'] });

		expect({ files, standardsLibraries }).toStrictEqual({
			files: ['src/keep.ts', 'standards/rules/code/a/05-rule/check.ts'],
			standardsLibraries: ['standards'],
		});
	});

	test('a walk that starts inside a fixture still lists it, which is how a rule is checked against its own fixtures', async () => {
		const { cwd } = setupRepo({ files: ['standards/rules/code/a/05-rule/fixtures/fail/src/bad.ts'] });

		writeFileSync(join(cwd, 'standards/lightsout-standards.json'), '{ "name": "acme", "formatVersion": 2 }\n');

		const { files } = await listSourceFiles({ cwd: join(cwd, 'standards/rules/code/a/05-rule/fixtures/fail'), sourceFileGlobs: ['**/*.ts'] });

		expect(files).toStrictEqual(['src/bad.ts']);
	});
});
