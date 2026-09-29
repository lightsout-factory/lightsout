import { dirname } from 'node:path';
import { gitTimeoutMs } from '#src/common/constants/gitTimeoutMs.ts';
import { runCommand } from '#src/common/processes/runCommand.ts';

interface Params {
	cwd: string;
}

/**
 * In a linked worktree this is the checkout it was added from, which is where a
 * gitignored file such as `.env` lives: a worktree is a fresh checkout and never carries one.
 */
export const readGitPrimaryCheckout = async ({ cwd }: Params): Promise<string | undefined> => {
	const common = await runCommand({ command: 'git rev-parse --path-format=absolute --git-common-dir', cwd, timeoutMs: gitTimeoutMs }).catch(() => undefined);
	const gitDir = common && common.exitCode === 0 ? common.stdout.trim() : '';

	return gitDir === '' ? undefined : dirname(gitDir);
};
