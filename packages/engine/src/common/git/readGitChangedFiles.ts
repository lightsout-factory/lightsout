import { readGitStatusEntries } from '#src/common/git/readGitStatusEntries.ts';

interface Params {
	cwd: string;
}

/**
 * Git's own account of what changed, the check on what agents report. Paths are
 * relative to `cwd`; undefined outside a git worktree.
 */
export const readGitChangedFiles = async ({ cwd }: Params): Promise<string[] | undefined> => {
	const entries = await readGitStatusEntries({ cwd, splitRenames: false });

	return entries?.map((entry) => entry.path);
};
