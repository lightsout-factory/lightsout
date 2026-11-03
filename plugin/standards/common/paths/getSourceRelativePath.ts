import { getPackageSourceRoot } from './getPackageSourceRoot.ts';

interface Params {
	/** A repo-relative file or folder path. */
	path: string;
	/** Every package directory the repo's manifests declare ('.' for the repo root). */
	packageDirectories: string[];
}

/**
 * The path inside the `src/` of the package holding it, or undefined for a
 * path outside every source tree. A layout rule reads a file's place from
 * where it sits under `src/`, so the package prefix and `src/` itself are
 * noise to it.
 */
export const getSourceRelativePath = ({ path, packageDirectories }: Params): string | undefined => {
	const root = getPackageSourceRoot({ path, packageDirectories });

	return path.startsWith(root) ? path.slice(root.length) : undefined;
};
