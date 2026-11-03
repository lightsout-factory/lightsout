import { gitTimeoutMs } from '#src/common/constants/gitTimeoutMs.ts';
import { runCommand } from '#src/common/processes/runCommand.ts';

interface Params {
	cwd: string;
}

/**
 * The root of the checkout `cwd` sits in — the primary checkout's or a linked
 * worktree's — or undefined outside any repository. Beside `readGitPrimaryCheckout`,
 * it tells a linked worktree from a subdirectory of the primary: both answer the
 * primary as their common checkout, but only the worktree has a root of its own.
 */
export const readGitTopLevel = async ({ cwd }: Params): Promise<string | undefined> => {
	const shown = await runCommand({ command: 'git rev-parse --show-toplevel', cwd, timeoutMs: gitTimeoutMs }).catch(() => undefined);
	const topLevel = shown && shown.exitCode === 0 ? shown.stdout.trim() : '';

	return topLevel === '' ? undefined : topLevel;
};
