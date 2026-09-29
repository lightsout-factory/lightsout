import { readGitPrimaryCheckout } from '#src/common/git/readGitPrimaryCheckout.ts';
import type { RunManifest } from '#src/contracts/run/RunManifest.ts';
import { WorktreeOwner } from '#src/contracts/worktree/WorktreeOwner.ts';
import { deleteWorktreeRecord } from '#src/worktree/records/deleteWorktreeRecord.ts';
import { readWorktreeRecord } from '#src/worktree/records/readWorktreeRecord.ts';
import { removeWorktree } from '#src/worktree/removeWorktree.ts';

interface Params {
	/** The checkout the ship just ran in — the run's workspace when it was isolated. */
	cwd: string;
	/** The run that shipped; its recorded workspace and branch are what decide whether a tree comes down. */
	manifest: RunManifest;
	onProgress?: (message: string) => void;
}

/**
 * The ownership record is the only licence to remove a tree: it outlives the
 * process that cut the tree, so a resumed run still knows. A `--no-worktree`
 * checkout and a queue-owned tree carry no `Implement` record, and a record
 * naming another path never licenses removing this one, so a reused branch
 * name cannot take down the wrong tree.
 *
 * The primary checkout is resolved here, so the answer is the same whether the
 * caller handed over the launching checkout or the workspace itself.
 */
const describeRemovableTree = async ({ cwd, manifest }: { cwd: string; manifest: RunManifest }) => {
	const { workspace, branch } = manifest;

	if (workspace === undefined || branch === undefined) {
		return undefined;
	}

	const primary = (await readGitPrimaryCheckout({ cwd })) ?? cwd;
	const record = await readWorktreeRecord({ cwd: primary, branch });
	const owned = record?.owner === WorktreeOwner.Implement && record.worktreePath === workspace;

	return owned ? { cwd: primary, branch, worktreePath: workspace } : undefined;
};

/**
 * Best effort and never throwing: the merge has already happened, and a failed
 * cleanup must not turn a shipped run into a failed one. The record is deleted
 * only when the removal worked, because a record deleted beside a surviving
 * tree leaves an unclaimed tree a later drain would adopt.
 */
export const removeShippedRunWorkspace = async ({ cwd, manifest, onProgress }: Params): Promise<void> => {
	const removable = await describeRemovableTree({ cwd, manifest });

	if (removable === undefined) {
		return;
	}

	const failure = await removeWorktree(removable);

	if (failure === undefined) {
		onProgress?.(`removed the worktree at ${removable.worktreePath}`);
		await deleteWorktreeRecord({ cwd: removable.cwd, branch: removable.branch });
	} else {
		onProgress?.(failure.error);
	}
};
