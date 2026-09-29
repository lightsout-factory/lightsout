import type { FrameworkCarveOut } from '../types/FrameworkCarveOut.ts';
import { isEntryFile } from './isEntryFile.ts';
import { isUnderRouterRoot } from './isUnderRouterRoot.ts';

interface Params {
	/** A repo-relative file path. */
	path: string;
	/** The carve-out of the package that governs this path. */
	carveOut: FrameworkCarveOut;
}

/**
 * A file router loads its route files and a framework resolves its
 * convention-named entry files, so nothing in the source tree imports either.
 *
 * Distinct from `isFrameworkNamedFile`, which asks who chose the name; see that
 * file for why the two stay apart while their bodies agree.
 */
export const isFrameworkLoadedFile = ({ path, carveOut }: Params): boolean => isUnderRouterRoot({ path, carveOut }) || isEntryFile({ path, carveOut });
