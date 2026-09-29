import { gitTimeoutMs } from '#src/common/constants/gitTimeoutMs.ts';
import { runCommand } from '#src/common/processes/runCommand.ts';

interface Params {
	cwd: string;
	defaultBranch: string;
	branch: string;
	onProgress?: (message: string) => void;
}

/** An unreadable answer counts as primary, so the cleanup still tries. */
const isLinkedWorktree = async ({ cwd }: { cwd: string }) => {
	const result = await runCommand({ command: 'git rev-parse --git-dir --git-common-dir', cwd, timeoutMs: gitTimeoutMs }).catch(() => undefined);

	if (result === undefined || result.exitCode !== 0) {
		return false;
	}

	const [gitDir, commonDir] = result.stdout.trim().split('\n');

	return gitDir !== undefined && commonDir !== undefined && gitDir !== commonDir;
};

/**
 * Skipped in a linked worktree: git refuses to check out the default branch a second time, and
 * routine failure lines teach a reader to ignore the one that matters. `-d` rather than `-D`, so a
 * branch git does not consider merged (as after a squash) is left rather than destroyed. Every
 * step is best effort: the merge already happened, and a failed checkout must not turn a shipped
 * result into a blocked one.
 */
export const syncDefaultBranch = async ({ cwd, defaultBranch, branch, onProgress }: Params): Promise<void> => {
	if (await isLinkedWorktree({ cwd })) {
		onProgress?.('sync: skipped — this checkout is a linked worktree, and the default branch lives in the primary one');

		return;
	}

	const steps = [`git checkout ${defaultBranch}`, 'git pull --ff-only', `git branch -d ${branch}`];

	for (const command of steps) {
		const result = await runCommand({ command, cwd, timeoutMs: gitTimeoutMs }).catch(() => undefined);

		onProgress?.(result?.exitCode === 0 ? `sync: ${command}` : `sync: ${command} did not work — leaving the local tree as it is`);
	}
};
