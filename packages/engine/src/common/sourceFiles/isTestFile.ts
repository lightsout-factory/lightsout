const testDirectory = /(^|\/)(tests?|__tests__|__mocks__|e2e)\//;

/**
 * The same, minus `test`/`tests`. Inside a standards pack those name a
 * document set — the standards about how to write tests — and the rule
 * implementations under one are ordinary source.
 */
const testDirectoryInStandardsPack = /(^|\/)(__tests__|__mocks__|e2e)\//;

const testFileName = /\.(test|spec)\./;

interface Params {
	/** A repo-relative path. */
	path: string;
	/**
	 * Repo-relative roots of the standards packs in the tree, as
	 * `listSourceFiles` reports them. Only a path beneath one is judged by a
	 * pack's naming; everything else reads as an ordinary repo.
	 */
	standardsLibraries?: string[];
}

/**
 * A file wrongly called a test quietly escapes the duplication tiers and
 * one-export-per-file, which is why a standards pack's `tests` set, a set name
 * rather than a directory of tests, is called out.
 *
 * Mirrors the default standards pack's `isTestFile`, and the two must agree:
 * the engine splits a file list with this copy and the reference-counting rules
 * re-ask with theirs. Neither can import the other, because a pack ships as a
 * bare directory with no manifest or `node_modules`. Change one, change the
 * other.
 *
 * @mirrors packages/standards-typescript/common/paths/isTestFile.ts
 */
export const isTestFile = ({ path, standardsLibraries = [] }: Params): boolean => {
	const inStandardsPack = standardsLibraries.some((root) => path.startsWith(`${root}/`));
	const directory = inStandardsPack ? testDirectoryInStandardsPack : testDirectory;

	return directory.test(path) || testFileName.test(path);
};
