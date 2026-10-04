import { readGitDefaultBranch } from '#src/common/git/readGitDefaultBranch.ts';
import { runOrDescribeFailure } from '#src/common/processes/runOrDescribeFailure.ts';
import type { WorktreeFailure } from '#src/common/types/WorktreeFailure.ts';

interface Params {
	cwd: string;
}

/**
 * The fetch comes first because it can repair a clone whose `origin/HEAD` was never set. A failed
 * fetch stops the run rather than cutting from a stale default the ship step would have to rebase.
 */
export const fetchDefaultBranch = async ({ cwd }: Params): Promise<string | WorktreeFailure> => {
	// The fetch crosses the network, so it takes a deadline of its own rather
	// than the git ceiling, which is sized for local reads.
	const fetchTimeoutMs = 60_000;
	const fetchFailure = await runOrDescribeFailure({ command: 'git fetch origin', cwd, timeoutMs: fetchTimeoutMs });

	if (fetchFailure !== undefined) {
		return { error: `git could not fetch origin: ${fetchFailure}` };
	}

	const defaultBranch = await readGitDefaultBranch({ cwd });
	const unset = "the remote's default branch is unset, so there is nothing to cut a branch from — set it with `git remote set-head origin --auto`";

	return defaultBranch ?? { error: unset };
};
