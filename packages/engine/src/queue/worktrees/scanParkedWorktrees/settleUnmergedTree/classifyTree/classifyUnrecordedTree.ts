import { BranchPhase } from '#src/contracts/queue/BranchPhase.ts';
import { writeBranchState } from '#src/queue/branchState/writeBranchState.ts';
import { readGitCommitsAhead } from '#src/queue/common/readGitCommitsAhead.ts';
import type { ParkedTree } from '#src/queue/worktrees/scanParkedWorktrees/common/types/ParkedTree.ts';
import { ParkedTreeBucket } from '#src/queue/worktrees/scanParkedWorktrees/settleUnmergedTree/common/constants/ParkedTreeBucket.ts';

interface Params {
	/** The main repository checkout, where every branch-state record lives. */
	cwd: string;
	tree: ParkedTree;
	defaultBranch: string;
	onProgress?: (message: string) => void;
}

/**
 * A count git could not give is not recorded: records are never deleted and a recorded phase
 * skips the count, so a wrong `building` would send a branch with finished commits back to a
 * worker on every future scan.
 */
export const classifyUnrecordedTree = async ({
	cwd,
	tree,
	defaultBranch,
	onProgress,
}: Params): Promise<typeof ParkedTreeBucket.Drain | typeof ParkedTreeBucket.Ship> => {
	const ahead = await readGitCommitsAhead({ cwd: tree.path, defaultBranch });

	if (ahead === undefined) {
		return ParkedTreeBucket.Drain;
	}

	const carriesCommits = ahead > 0;

	await writeBranchState({ cwd, branch: tree.branch, phase: carriesCommits ? BranchPhase.Ready : BranchPhase.Building, onProgress });

	return carriesCommits ? ParkedTreeBucket.Ship : ParkedTreeBucket.Drain;
};
