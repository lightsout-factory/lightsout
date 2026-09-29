import { gitTimeoutMs } from '#src/common/constants/gitTimeoutMs.ts';
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
	// The command runs through a shell, so the path is single-quoted to keep it
	// from becoming shell syntax.
	const quoted = `'${path.replaceAll("'", `'\\''`)}'`;
	const shown = await runCommand({ command: `git show HEAD:${quoted}`, cwd, timeoutMs: gitTimeoutMs }).catch(() => undefined);

	return shown && shown.exitCode === 0 ? shown.stdout : undefined;
};
