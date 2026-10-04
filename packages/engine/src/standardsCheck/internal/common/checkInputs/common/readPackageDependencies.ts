import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { readDependencyNames } from '#src/common/workspace/readDependencyNames.ts';

interface Params {
	cwd: string;
	packagesDir: string;
}

// Keyed by repo-relative package root, with `.` for the repo itself.
export const readPackageDependencies = async ({ cwd, packagesDir }: Params): Promise<Map<string, string[]>> => {
	const dependencies = new Map<string, string[]>();

	dependencies.set('.', (await readDependencyNames({ manifestPath: join(cwd, 'package.json') })) ?? []);

	const children = await readdir(join(cwd, packagesDir)).catch(() => []);

	for (const name of children.sort()) {
		const names = await readDependencyNames({ manifestPath: join(cwd, packagesDir, name, 'package.json') });

		if (names !== undefined) {
			dependencies.set(`${packagesDir}/${name}`, names);
		}
	}

	return dependencies;
};
