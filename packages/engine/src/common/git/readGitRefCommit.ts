import { gitTimeoutMs } from '#src/common/constants/gitTimeoutMs.ts';
import { quoteShellArgument } from '#src/common/processes/quoteShellArgument.ts';
import { runCommand } from '#src/common/processes/runCommand.ts';

interface Params {
	cwd: string;
	/** A full ref name, such as `refs/heads/<branch>` or `refs/remotes/origin/<branch>`. */
	ref: string;
}

/**
 * The argument is quoted because the `^{commit}` peel suffix carries shell
 * metacharacters, and a branch in the ref may carry its own. Nothing is fetched, so every tree resolution does not wait on
 * the network; a remote-tracking ref answers what the last fetch left behind.
 */
export const readGitRefCommit = async ({ cwd, ref }: Params): Promise<string | undefined> => {
	const peeled = quoteShellArgument({ argument: `${ref}^{commit}` });
	const named = await runCommand({ command: `git rev-parse --verify --quiet ${peeled}`, cwd, timeoutMs: gitTimeoutMs }).catch(() => undefined);

	return named?.exitCode === 0 ? named.stdout.trim() : undefined;
};
