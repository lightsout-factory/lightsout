import { gitTimeoutMs } from '#src/common/constants/gitTimeoutMs.ts';
import { quoteShellArgument } from '#src/common/processes/quoteShellArgument.ts';
import { runCommand } from '#src/common/processes/runCommand.ts';

interface Params {
	cwd: string;
	defaultBranch: string;
}

/**
 * Undefined is never folded into zero: "this branch has no commits" and "git
 * could not be read" send a worktree to different places.
 */
export const readGitCommitsAhead = async ({ cwd, defaultBranch }: Params): Promise<number | undefined> => {
	const range = quoteShellArgument({ argument: `origin/${defaultBranch}..HEAD` });
	const counted = await runCommand({ command: `git rev-list --count ${range}`, cwd, timeoutMs: gitTimeoutMs }).catch(() => undefined);

	if (counted?.exitCode !== 0) {
		return undefined;
	}

	const commits = Number.parseInt(counted.stdout.trim(), 10);

	return Number.isFinite(commits) ? commits : undefined;
};
