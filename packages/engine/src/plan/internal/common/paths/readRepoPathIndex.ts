import type { Dirent } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { join, relative } from 'node:path';
import type { RepoPathIndex } from '#src/plan/internal/common/types/RepoPathIndex.ts';

const prunedDirs = new Set(['node_modules', '.git']);

interface Params {
	cwd: string;
}

const readEntries = ({ dir }: { dir: string }) => readdir(dir, { withFileTypes: true }).catch(() => undefined);

/**
 * Undefined when ANY directory below could not be read. A partial answer would
 * block a plan silently: the caller's degraded-index guard fires only on an
 * empty pool, so a missing subtree would report every file under it as absent.
 */
const walkFiles = async ({ cwd, dir, entries }: { cwd: string; dir: string; entries: Dirent[] }): Promise<string[] | undefined> => {
	const files: string[] = [];

	for (const entry of entries) {
		if (prunedDirs.has(entry.name)) {
			continue;
		}

		const path = join(dir, entry.name);

		if (!entry.isDirectory()) {
			files.push(relative(cwd, path));
			continue;
		}

		const nested = await readEntries({ dir: path });
		const below = nested === undefined ? undefined : await walkFiles({ cwd, dir: path, entries: nested });

		if (below === undefined) {
			return undefined;
		}

		files.push(...below);
	}

	return files;
};

/**
 * Deliberately NOT `listSourceFiles`: that walk omits files that really exist
 * (`.d.ts`, dot directories, build output, fixtures), and a check that BLOCKS a
 * plan may not rest on a deliberately partial pool.
 *
 * Dot directories are kept: `.lightsout` and `.claude` are real anchors a plan
 * names. An unreadable root yields an empty index, which the caller reads as
 * "the tree could not be seen" rather than "nothing exists".
 */
export const readRepoPathIndex = async ({ cwd }: Params): Promise<RepoPathIndex> => {
	const entries = await readEntries({ dir: cwd });
	const topLevelDirs = new Set((entries ?? []).filter((entry) => entry.isDirectory() && !prunedDirs.has(entry.name)).map((entry) => entry.name));
	const files = entries === undefined ? undefined : await walkFiles({ cwd, dir: cwd, entries });

	return { topLevelDirs, files: files ?? [] };
};
