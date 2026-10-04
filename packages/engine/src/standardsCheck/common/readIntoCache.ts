import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

interface Params {
	cwd: string;
	/** Repo-relative paths to make available. */
	paths: string[];
	/** The run's shared cache — a path already in it is never read a second time. */
	cache: Map<string, string>;
}

/**
 * A path that cannot be read is left out of the cache rather than mapped to an
 * empty string, so a check can tell "there is no text here" from "this file is
 * empty".
 *
 * @returns a fresh map holding only the asked-for paths that have text, in the order asked
 */
export const readIntoCache = async ({ cwd, paths, cache }: Params): Promise<Map<string, string>> => {
	const texts = new Map<string, string>();

	for (const path of paths) {
		if (!cache.has(path)) {
			const text = await readFile(join(cwd, path), 'utf8').catch(() => undefined);

			if (text !== undefined) {
				cache.set(path, text);
			}
		}

		const cached = cache.get(path);

		if (cached !== undefined) {
			texts.set(path, cached);
		}
	}

	return texts;
};
