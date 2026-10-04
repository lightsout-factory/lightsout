import { PullRequestState } from '#src/common/constants/PullRequestState.ts';
import { BranchPhase } from '#src/contracts/queue/BranchPhase.ts';
import { readBranchState } from '#src/queue/branchState/readBranchState.ts';
import { writeBranchState } from '#src/queue/branchState/writeBranchState.ts';
import type { MergeEvidence } from '#src/queue/common/establishBranchMerge/MergeEvidence.ts';
import { findPullRequest } from '#src/ship/forge/findPullRequest.ts';

interface Params {
	/** The main repository checkout, where every branch-state record lives. */
	cwd: string;
	branch: string;
	onProgress?: (message: string) => void;
}

/**
 * A merge is never inferred from a missing branch, an absent open pull request
 * or a clean worktree: absence of evidence never becomes evidence of a merge. The
 * record is read first and written after a forge answer, so later runs stay offline.
 */
export const establishBranchMerge = async ({ cwd, branch, onProgress }: Params): Promise<MergeEvidence | undefined> => {
	const recorded = await readBranchState({ cwd, branch });
	let evidence: MergeEvidence | undefined;

	if (recorded?.phase === BranchPhase.Merged) {
		evidence = {};
	} else {
		const pullRequest = await findPullRequest({ branch, cwd, state: PullRequestState.Merged });

		if (pullRequest !== undefined) {
			await writeBranchState({ cwd, branch, phase: BranchPhase.Merged, onProgress });

			evidence = { pullRequest };
		}
	}

	return evidence;
};
