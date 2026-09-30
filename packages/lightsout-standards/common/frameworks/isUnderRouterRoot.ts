import type { FrameworkCarveOut } from '../types/FrameworkCarveOut.ts';
import { getSourceRoot } from './getSourceRoot.ts';

interface Params {
	/** A repo-relative file or folder path. */
	path: string;
	/** The carve-out of the package that governs this path. */
	carveOut: FrameworkCarveOut;
}

/**
 * Matched only DIRECTLY under the package's `src/`: at arbitrary depth an
 * ordinary domain folder called `routes` would exempt its whole subtree from
 * rules that have every reason to judge it.
 */
export const isUnderRouterRoot = ({ path, carveOut }: Params): boolean => {
	const sourceRoot = getSourceRoot({ carveOut });

	return path.startsWith(sourceRoot) && carveOut.routerRoots.includes(path.slice(sourceRoot.length).replace(/\/.*$/, ''));
};
