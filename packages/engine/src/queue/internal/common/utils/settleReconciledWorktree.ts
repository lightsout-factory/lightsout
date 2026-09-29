import { readGitChangedFiles } from '#src/common/git/readGitChangedFiles.ts';
import { deleteWorktreeRecord } from '#src/worktree/records/deleteWorktreeRecord.ts';
import { removeWorktree } from '#src/worktree/removeWorktree.ts';

interface Params {
	/** The main repository checkout. */
	cwd: string;
	/** The worktree as the caller already spells it, never re-derived here. */
	worktreePath: string;
	branch: string;
	onProgress?: (message: string) => void;
}

/**
 * A reconciled ticket never reaches the ship step, so a clean tree left here would
 * be rediscovered by every later drain. A dirty one is never removed: a merged
 * pull request says nothing about work begun there since.
 *
 * The ownership record is deleted only after a removal that worked, because a
 * standing tree without one is adopted by a later drain.
 */
export const settleReconciledWorktree = async ({ cwd, worktreePath, branch, onProgress }: Params): Promise<string | undefined> => {
	const changed = await readGitChangedFiles({ cwd: worktreePath });

	if (changed === undefined) {
		return undefined;
	}

	if (changed.length > 0) {
		onProgress?.(`the worktree at ${worktreePath} has uncommitted changes, so it was left in place`);

		return ` — the worktree at ${worktreePath} was left in place because it has uncommitted changes`;
	}

	const removal = await removeWorktree({ cwd, worktreePath, branch });

	if (removal === undefined) {
		await deleteWorktreeRecord({ cwd, branch });
	}

	return undefined;
};
