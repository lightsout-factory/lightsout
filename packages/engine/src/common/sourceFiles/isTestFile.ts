import picomatch from 'picomatch';

interface Params {
	/** A repo-relative path, `/`-separated. */
	path: string;
	/** The repo's `test-files` globs, from the repo root. */
	testFileGlobs: string[];
}

// One compiled matcher per glob list: the list is the config's own array, so
// it is compiled once per run rather than once per file.
const matchers = new WeakMap<string[], (path: string) => boolean>();

/**
 * A test-side file is whatever the repo's `test-files` globs say it is. The
 * engine holds no naming or folder convention of its own: a repo whose tests
 * sit in `spec/`, or are named `test_*.py`, says so in its config.
 */
export const isTestFile = ({ path, testFileGlobs }: Params): boolean => {
	const known = matchers.get(testFileGlobs);
	const matcher = known ?? picomatch(testFileGlobs, { dot: true });

	if (known === undefined) {
		matchers.set(testFileGlobs, matcher);
	}

	return matcher(path);
};
