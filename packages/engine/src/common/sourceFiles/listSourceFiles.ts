import { readdir } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { standardsPackRootFile } from '#src/common/constants/standardsPackRootFile.ts';

/**
 * Skipped only outside a `src` folder: a build tool writes beside `src`, never
 * inside it, and a name like `coverage` is also a source folder
 * (`packages/engine/src/coverage/`). A walk that skips one hides it from every
 * standards rule silently. Output elsewhere belongs in the config's `generated`
 * list.
 */
const buildOutputDirs = new Set(['dist', 'build', 'coverage', 'out']);
const sourceExtension = /\.(m|c)?[jt]sx?$/;

interface Params {
	cwd: string;
	/** Repo-relative path prefixes to exclude (the config's `generated` list). */
	exclude?: string[];
}

/**
 * Test files are included; callers that must ignore them filter with
 * `isTestFile`.
 *
 * A standards pack's `fixtures/` folders are skipped: their failing samples
 * violate the very rule they prove, and no prefix could exclude them since they
 * sit inside every rule. The pruning is by directory, so a walk that starts
 * inside a fixture still lists it, which is how `standards-validate` runs a
 * check against one.
 *
 * Pack roots are reported because `isTestFile` needs them and no caller can
 * cheaply repeat the walk.
 */
export const listSourceFiles = async ({ cwd, exclude = [] }: Params): Promise<{ files: string[]; standardsPacks: string[] }> => {
	const files: string[] = [];
	const standardsPacks: string[] = [];
	const fixturesDir = 'fixtures';

	const walk = async (dir: string, insideStandardsPack: boolean, insideSource: boolean) => {
		const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
		const isPackRoot = !insideStandardsPack && entries.some((entry) => entry.name === standardsPackRootFile);
		const insidePack = insideStandardsPack || isPackRoot;

		if (isPackRoot) {
			standardsPacks.push(relative(cwd, dir));
		}

		for (const entry of entries) {
			if (entry.name.startsWith('.') || entry.name === 'node_modules' || (!insideSource && buildOutputDirs.has(entry.name))) {
				continue;
			}

			const path = join(dir, entry.name);

			if (entry.isDirectory()) {
				if (insidePack && entry.name === fixturesDir) {
					continue;
				}

				await walk(path, insidePack, insideSource || entry.name === 'src');
				continue;
			}

			const rel = relative(cwd, path);

			if (!sourceExtension.test(entry.name) || entry.name.endsWith('.d.ts')) {
				continue;
			}

			if (exclude.some((prefix) => rel.startsWith(prefix.replace(/\/$/, '')))) {
				continue;
			}

			files.push(rel);
		}
	};

	await walk(cwd, false, false);

	return { files: files.sort(), standardsPacks: standardsPacks.sort() };
};
