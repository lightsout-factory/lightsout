import { gitTimeoutMs } from '#src/common/constants/gitTimeoutMs.ts';
import { runCommand } from '#src/common/processes/runCommand.ts';

interface Params {
	cwd: string;
	/** A full ref name, such as `refs/heads/<branch>` or `refs/remotes/origin/<branch>`. */
	ref: string;
}

/**
 * The argument is quoted because the `^{commit}` peel suffix carries shell
 * metacharacters. Nothing is fetched, so every tree resolution does not wait on
 * the network; a remote-tracking ref answers what the last fetch left behind.
 */
export const readGitRefCommit = async ({ cwd, ref }: Params): Promise<string | undefined> => {
	const named = await runCommand({ command: `git rev-parse --verify --quiet '${ref}^{commit}'`, cwd, timeoutMs: gitTimeoutMs }).catch(() => undefined);

	return named?.exitCode === 0 ? named.stdout.trim() : undefined;
};
