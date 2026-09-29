import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

interface Params {
	root: string;
}

/**
 * Every file under one fixture side, as `/`-separated paths relative to it,
 * sorted. A side is a real source tree rather than a single file, so it is read
 * recursively. A side that does not exist lists nothing rather than failing: a
 * built pack ships without its fixtures, and that is a normal state.
 *
 * @param root - absolute path of the side's folder, e.g. `<rule>/fixtures/pass`
 */
export const listFixtureFiles = async ({ root }: Params): Promise<string[]> => {
	const entries = await readdir(root, { withFileTypes: true }).catch(() => []);
	const paths: string[] = [];

	for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
		if (entry.isDirectory()) {
			paths.push(...(await listFixtureFiles({ root: join(root, entry.name) })).map((path) => `${entry.name}/${path}`));
		} else {
			paths.push(entry.name);
		}
	}

	return paths;
};
