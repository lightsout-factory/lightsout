import { gitTimeoutMs } from '#src/common/constants/gitTimeoutMs.ts';
import { readGitRefCommit } from '#src/common/git/readGitRefCommit.ts';
import { quoteShellArgument } from '#src/common/processes/quoteShellArgument.ts';
import { runCommand } from '#src/common/processes/runCommand.ts';
import { runOrDescribeFailure } from '#src/common/processes/runOrDescribeFailure.ts';
import type { WorktreeFailure } from '#src/common/types/WorktreeFailure.ts';
import { readBranchWorktree } from '#src/worktree/readBranchWorktree.ts';

interface Params {
	cwd: string;
	/** The ticket branch — the ticket-folder segment of a plan address. */
	branch: string;
}

const readAncestry = async ({ cwd, ancestor, descendant }: { cwd: string; ancestor: string; descendant: string }) => {
	const [older, newer] = [ancestor, descendant].map((argument) => quoteShellArgument({ argument }));
	const asked = await runCommand({ command: `git merge-base --is-ancestor ${older} ${newer}`, cwd, timeoutMs: gitTimeoutMs }).catch(() => undefined);

	if (asked?.exitCode !== 0 && asked?.exitCode !== 1) {
		return undefined;
	}

	return asked.exitCode === 0;
};

const readBranchRelation = async ({ cwd, local, remote }: { cwd: string; local: string; remote: string }) => {
	const behind = await readAncestry({ cwd, ancestor: local, descendant: remote });
	const ahead = await readAncestry({ cwd, ancestor: remote, descendant: local });
	let relation: 'behind' | 'ahead' | 'diverged' | undefined;

	if (ahead === true) {
		relation = 'ahead';
	} else if (behind === true) {
		relation = 'behind';
	} else if (ahead === false && behind === false) {
		relation = 'diverged';
	}

	return relation;
};

/**
 * Only a branch no worktree holds is moved: `git branch -f` on a checked-out branch would leave that
 * tree's index describing a commit it no longer stands on.
 */
const fastForwardTicketBranch = async ({ cwd, branch, local, remote }: { cwd: string; branch: string; local: string; remote: string }) => {
	const holder = await readBranchWorktree({ cwd, branch });

	if (holder !== undefined) {
		return {
			error: `the local branch '${branch}' at ${local} is behind the pushed one at ${remote}, and the worktree at ${holder} is standing on it — bring it up to date there with \`git pull --ff-only\``,
		};
	}

	const [name, commit] = [branch, remote].map((argument) => quoteShellArgument({ argument }));
	const failure = await runOrDescribeFailure({ command: `git branch -f ${name} ${commit}`, cwd });

	return failure === undefined ? { startPoint: undefined } : { error: `git could not move '${branch}' to the pushed commit ${remote}: ${failure}` };
};

/**
 * Every plan of a ticket implements on one branch, so a later plan must build on what that branch
 * already carries; starting from `HEAD` or the default branch would split the ticket's work. Nothing
 * is fetched here. Only a strict fast-forward of a branch no worktree holds is done unasked;
 * reconciling anything else is a decision only the human can make.
 */
export const prepareWorkOrderBranch = async ({ cwd, branch }: Params): Promise<{ startPoint?: string } | WorktreeFailure> => {
	const local = await readGitRefCommit({ cwd, ref: `refs/heads/${branch}` });
	const remote = await readGitRefCommit({ cwd, ref: `refs/remotes/origin/${branch}` });

	if (remote === undefined || local === remote) {
		return {};
	}

	if (local === undefined) {
		return { startPoint: remote };
	}

	const relation = await readBranchRelation({ cwd, local, remote });
	let prepared: { startPoint?: string } | WorktreeFailure;

	if (relation === 'ahead') {
		prepared = {};
	} else if (relation === 'behind') {
		prepared = await fastForwardTicketBranch({ cwd, branch, local, remote });
	} else if (relation === 'diverged') {
		prepared = {
			error: `the local branch '${branch}' at ${local} has diverged from the pushed one at ${remote} — reconcile them before planning or implementing a later plan of this ticket`,
		};
	} else {
		prepared = { error: `git could not compare the local branch '${branch}' at ${local} with the pushed one at ${remote}` };
	}

	return prepared;
};
