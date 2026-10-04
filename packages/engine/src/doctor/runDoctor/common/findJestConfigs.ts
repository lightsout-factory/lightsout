import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

interface Params {
	/** Absolute path of one package directory. */
	packageDir: string;
}

/** Both `test/` and `tests/` are scanned because `isTestFile` accepts both spellings. */
export const findJestConfigs = async ({ packageDir }: Params): Promise<string[]> => {
	const rootEntries: string[] = await readdir(packageDir).catch(() => []);
	const found = rootEntries.filter((name) => /^jest(\..+)?\.config\.(js|cjs|mjs|ts)$/.test(name)).map((name) => join(packageDir, name));

	for (const testDir of ['test', 'tests']) {
		const testEntries: string[] = await readdir(join(packageDir, testDir), { recursive: true }).catch(() => []);

		found.push(
			...testEntries
				.filter((name) => typeof name === 'string' && /(^|\/)jest[^/]*\.config\.(js|cjs|mjs|ts)$/.test(name))
				.map((name) => join(packageDir, testDir, name)),
		);
	}

	return found;
};
