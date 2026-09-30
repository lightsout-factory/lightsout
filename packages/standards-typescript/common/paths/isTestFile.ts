const testDirectory = /(^|\/)(tests?|__tests__|__mocks__|e2e)\//;

/**
 * Minus `test`/`tests`: inside a standards pack those name a document set — the
 * standards about how to write tests — and the rule implementations under one
 * are ordinary source.
 */
const testDirectoryInStandardsPack = /(^|\/)(__tests__|__mocks__|e2e)\//;

const testFileName = /\.(test|spec)\./;

interface Params {
	/** A repo-relative path. */
	path: string;
	/** Repo-relative standards pack roots, as the input carries them. Only a path beneath one is judged by a pack's naming. */
	standardsLibraries?: string[];
}

/**
 * It has to agree with how the engine split the same file list into `source`
 * and `tests`, so it mirrors the engine's `isTestFile`. The copy cannot be
 * collapsed: this pack ships as a bare directory with no manifest and no
 * `node_modules`, so every value it imports has to resolve inside its own tree.
 * Change one, change the other.
 *
 * @mirrors packages/engine/src/common/sourceFiles/isTestFile.ts
 */
export const isTestFile = ({ path, standardsLibraries = [] }: Params): boolean => {
	const inStandardsPack = standardsLibraries.some((root) => path.startsWith(`${root}/`));
	const directory = inStandardsPack ? testDirectoryInStandardsPack : testDirectory;

	return directory.test(path) || testFileName.test(path);
};
