import { dirname } from 'node:path';
import { glob } from 'tinyglobby';
import { standardsLibraryRootFile } from '#src/common/constants/standardsLibraryRootFile.ts';
import { readGitFileList } from '#src/common/git/readGitFileList.ts';
import { isSourceFile } from '#src/common/sourceFiles/isSourceFile.ts';

interface Params {
	cwd: string;
	/** The repo's `source-files` globs: every code file, its tests included. */
	sourceFileGlobs: string[];
	/** Repo-relative path prefixes to exclude (the config's `generated` and `vendored` lists). */
	exclude?: string[];
}

/**
 * Outside a git worktree there is no ignore list to honour, so the globs alone
 * decide, their `!` globs pruning whole folders as they go.
 */
const listUngitFiles = async ({ cwd, sourceFileGlobs }: { cwd: string; sourceFileGlobs: string[] }) => {
	const patterns = sourceFileGlobs.filter((pattern) => !pattern.startsWith('!'));
	const ignore = sourceFileGlobs.filter((pattern) => pattern.startsWith('!')).map((pattern) => pattern.slice(1));

	return glob([...patterns, `**/${standardsLibraryRootFile}`], { cwd, ignore, onlyFiles: true, expandDirectories: false });
};

/**
 * The repo's code files, as its own `source-files` globs name them, from the
 * files git lists (outside a worktree, from the globs alone). Test files are
 * included; callers that must ignore them filter with `isTestFile` and the
 * repo's `test-files` globs.
 *
 * A standards library's `fixtures/` folders are skipped: their failing samples
 * violate the very rule they prove, and no prefix could exclude them since they
 * sit inside every rule. A walk that starts inside a fixture still lists it,
 * which is how `standards-validate` runs a check against one.
 *
 * Library roots are reported because a check is handed them, so it can tell
 * which library a file belongs to, and no caller can cheaply repeat the walk.
 */
export const listSourceFiles = async ({ cwd, sourceFileGlobs, exclude = [] }: Params): Promise<{ files: string[]; standardsLibraries: string[] }> => {
	const listed = (await readGitFileList({ cwd })) ?? (await listUngitFiles({ cwd, sourceFileGlobs }));
	const standardsLibraries = listed
		.filter((path) => path === standardsLibraryRootFile || path.endsWith(`/${standardsLibraryRootFile}`))
		// `''` is a library whose root is `cwd` itself.
		.map((path) => (dirname(path) === '.' ? '' : dirname(path)))
		.sort();
	const isLibraryFixture = (path: string) =>
		standardsLibraries.some(
			(root) =>
				(root === '' || path.startsWith(`${root}/`)) &&
				path
					.slice(root === '' ? 0 : root.length + 1)
					.split('/')
					.includes('fixtures'),
		);
	const isExcluded = (path: string) => exclude.some((prefix) => path.startsWith(prefix.replace(/\/$/, '')));
	const files = listed.filter((path) => isSourceFile({ path, sourceFileGlobs }) && !isLibraryFixture(path) && !isExcluded(path));

	return { files: [...new Set(files)].sort(), standardsLibraries };
};
