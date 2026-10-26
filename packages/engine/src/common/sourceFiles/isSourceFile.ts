import { matchesGlobs } from '#src/common/sourceFiles/matchesGlobs.ts';

interface Params {
	/** A repo-relative path, `/`-separated. */
	path: string;
	/** The repo's `source-files` globs, from the repo root. */
	sourceFileGlobs: string[];
}

/**
 * A code file is whatever the repo's `source-files` globs say it is, its tests
 * included — `test-files` says which of them are tests. The engine holds no
 * language, extension or folder of its own.
 */
export const isSourceFile = ({ path, sourceFileGlobs }: Params): boolean => matchesGlobs({ path, globs: sourceFileGlobs });
