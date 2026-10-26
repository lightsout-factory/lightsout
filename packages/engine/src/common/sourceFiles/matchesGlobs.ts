import picomatch from 'picomatch';

interface Params {
	/** A repo-relative path, `/`-separated. */
	path: string;
	/** Globs from the repo root; one starting with `!` excludes what it matches. */
	globs: string[];
}

// One compiled matcher per glob list: the list is the config's own array, so
// it is compiled once per run rather than once per file.
const matchers = new WeakMap<string[], (path: string) => boolean>();

const compile = ({ globs }: { globs: string[] }) => {
	const included = globs.filter((glob) => !glob.startsWith('!'));
	const excluded = globs.filter((glob) => glob.startsWith('!')).map((glob) => glob.slice(1));
	const isIncluded = included.length === 0 ? () => false : picomatch(included);
	const isExcluded = excluded.length === 0 ? () => false : picomatch(excluded);

	return (path: string) => isIncluded(path) && !isExcluded(path);
};

/**
 * A path matches when any glob includes it and no `!` glob excludes it — the
 * order-free reading `.gitignore`-style lists are written for. Standard glob
 * semantics otherwise: `**` does not step into a dot-folder unless a glob names
 * one.
 */
export const matchesGlobs = ({ path, globs }: Params): boolean => {
	const known = matchers.get(globs);
	const matcher = known ?? compile({ globs });

	if (known === undefined) {
		matchers.set(globs, matcher);
	}

	return matcher(path);
};
