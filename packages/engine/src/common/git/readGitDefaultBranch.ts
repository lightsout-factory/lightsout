import { gitTimeoutMs } from '#src/common/constants/gitTimeoutMs.ts';
import { runCommand } from '#src/common/processes/runCommand.ts';

interface Params {
	cwd: string;
}

/**
 * `origin/HEAD` is a local ref git writes at clone time and `git remote
 * set-head` refreshes, so a repo that has never had one answers undefined rather
 * than guessing `main`, which ship would then merge into.
 */
export const readGitDefaultBranch = async ({ cwd }: Params): Promise<string | undefined> => {
	const head = await runCommand({ command: 'git rev-parse --abbrev-ref origin/HEAD', cwd, timeoutMs: gitTimeoutMs }).catch(() => undefined);
	const name = head && head.exitCode === 0 ? head.stdout.trim() : '';
	const remotePrefix = 'origin/';

	return name.startsWith(remotePrefix) ? name.slice(remotePrefix.length) : undefined;
};
