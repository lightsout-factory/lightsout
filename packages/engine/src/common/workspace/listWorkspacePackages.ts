import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

interface Params {
	cwd: string;
	/** Monorepo package parent dir (e.g. 'packages'). */
	packagesDir: string;
}

/**
 * Never parses the manifest: a package whose manifest is malformed still exists,
 * and `readPackageManifest` gives the precise error for it.
 */
export const listWorkspacePackages = async ({ cwd, packagesDir }: Params): Promise<string[]> => {
	const root = join(cwd, packagesDir);
	const entries = await readdir(root, { withFileTypes: true }).catch(() => []);
	const directories = entries.filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'));
	const hasManifest = await Promise.all(
		directories.map(({ name }) =>
			stat(join(root, name, 'package.json'))
				.then(() => true)
				.catch(() => false),
		),
	);

	return directories.filter((_, index) => hasManifest[index]).map(({ name }) => name);
};
