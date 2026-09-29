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
 * A file router names every file inside its directory (`__root.tsx`,
 * `runs.$runId.tsx`), and a framework that resolves an entry file by convention
 * chose that name too (`main.ts`, `router.tsx`), so a rule comparing the export
 * to the file name is asking for an edit the framework forbids.
 *
 * This and `isFrameworkLoadedFile` share a body but stay separate, because they
 * are different questions: one asks who chose the name, the other asks who
 * loads the file.
 */
export const isFrameworkNamedFile = ({ path, carveOut }: Params): boolean => isUnderRouterRoot({ path, carveOut }) || isEntryFile({ path, carveOut });
