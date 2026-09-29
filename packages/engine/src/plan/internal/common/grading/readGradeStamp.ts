import { readGitChangedFiles } from '#src/common/git/readGitChangedFiles.ts';
import { readGitHeadCommit } from '#src/common/git/readGitHeadCommit.ts';

interface Params {
	cwd: string;
}

/**
 * `readGitChangedFiles` fails independently of the commit read: an undefined
 * flag means the tree state was NOT READ, never that it was read and found
 * clean. The commit is recorded even on a dirty tree, because grading almost
 * always happens with uncommitted work.
 */
export const readGradeStamp = async ({ cwd }: Params): Promise<{ commit: string | undefined; treeDirty: boolean | undefined }> => {
	const commit = await readGitHeadCommit({ cwd });
	const changed = commit === undefined ? undefined : await readGitChangedFiles({ cwd });

	return { commit, treeDirty: changed === undefined ? undefined : changed.length > 0 };
};
