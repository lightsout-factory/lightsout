import { matchesGlobs } from '#src/common/sourceFiles/matchesGlobs.ts';

interface Params {
	/** A repo-relative path, `/`-separated. */
	path: string;
	/** The repo's `test-files` globs, from the repo root. */
	testFileGlobs: string[];
}

/**
 * A test-side file is whatever the repo's `test-files` globs say it is. The
 * engine holds no naming or folder convention of its own: a repo whose tests
 * sit in `spec/`, or are named `test_*.py`, says so in its config.
 */
export const isTestFile = ({ path, testFileGlobs }: Params): boolean => matchesGlobs({ path, globs: testFileGlobs });
