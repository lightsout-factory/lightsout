import { getDirectory } from '../paths/getDirectory.ts';
import { isBarrelFile } from '../paths/isBarrelFile.ts';
import type { PackageEntries } from '../types/PackageEntries.ts';

interface Params {
	/** A repo-relative file path. */
	path: string;
	/** What the run's manifests say, as `readPackageEntries` reads them. */
	entries: PackageEntries;
}

/**
 * An index file at a package's root or its `src/` counts as well as any file
 * the manifest names, because a manifest may name its entry in the built output — `./dist/
 * index.js` — which a run never sees, while the `src/index.ts` it is built from
 * is right here; and because a subpath export can point anywhere, a folder's
 * `index.ts` included.
 */
export const isPackageEntry = ({ path, entries }: Params): boolean => {
	if (entries.entryFiles.has(path)) {
		return true;
	}

	const directory = getDirectory({ path });

	return (
		isBarrelFile({ path }) &&
		[...entries.packageDirectories].some(
			(packageDirectory) => directory === packageDirectory || directory === (packageDirectory === '.' ? 'src' : `${packageDirectory}/src`),
		)
	);
};
