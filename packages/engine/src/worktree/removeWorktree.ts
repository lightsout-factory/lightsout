import { gitTimeoutMs } from '#src/common/constants/gitTimeoutMs.ts';
import { quoteShellArgument } from '#src/common/processes/quoteShellArgument.ts';
import { runCommand } from '#src/common/processes/runCommand.ts';
import { runOrDescribeFailure } from '#src/common/processes/runOrDescribeFailure.ts';
import type { WorktreeFailure } from '#src/worktree/common/types/WorktreeFailure.ts';

interface Params {
	cwd: string;
	worktreePath: string;
	branch: string;
}

/**
 * Best effort, because the merge already happened and a failed cleanup must not turn a shipped branch
 * into a failed one. Only the removal's refusal is answered, so the caller can tell a tree that came
 * down. The ownership record is left for the caller to delete after a removal that worked: a record
 * deleted beside a surviving tree leaves the unclaimed tree a later drain would adopt.
 */
export const removeWorktree = async ({ cwd, worktreePath, branch }: Params): Promise<WorktreeFailure | undefined> => {
	const removal = await runOrDescribeFailure({ command: `git worktree remove --force ${quoteShellArgument({ argument: worktreePath })}`, cwd });

	for (const command of ['git worktree prune', `git branch -d ${quoteShellArgument({ argument: branch })}`]) {
		await runCommand({ command, cwd, timeoutMs: gitTimeoutMs }).catch(() => undefined);
	}

	return removal === undefined ? undefined : { error: `git could not remove the worktree at ${worktreePath}: ${removal}` };
};
