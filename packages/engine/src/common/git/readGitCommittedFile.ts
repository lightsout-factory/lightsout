import { gitTimeoutMs } from '#src/common/constants/gitTimeoutMs.ts';
import { quoteShellArgument } from '#src/common/processes/quoteShellArgument.ts';
import { runCommand } from '#src/common/processes/runCommand.ts';

interface Params {
	cwd: string;
	/** Repo-relative path. */
	path: string;
}

/**
 * A run starts from a clean tree, so `HEAD` is the state before any agent wrote
 * anything, and a step re-entered after a park reads the same answer.
 */
export const readGitCommittedFile = async ({ cwd, path }: Params): Promise<string | undefined> => {
	const committed = quoteShellArgument({ argument: `HEAD:${path}` });
	const shown = await runCommand({ command: `git show ${committed}`, cwd, timeoutMs: gitTimeoutMs }).catch(() => undefined);

	return shown && shown.exitCode === 0 ? shown.stdout : undefined;
};
