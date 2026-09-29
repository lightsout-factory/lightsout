import { gitTimeoutMs } from '#src/common/constants/gitTimeoutMs.ts';
import { runCommand } from '#src/common/processes/runCommand.ts';

interface Params {
	cwd: string;
}

/**
 * A detached HEAD answers the literal word `HEAD`, which is not a branch
 * anything can be pushed to, so it is reported as undefined.
 */
export const readGitCurrentBranch = async ({ cwd }: Params): Promise<string | undefined> => {
	const branch = await runCommand({ command: 'git rev-parse --abbrev-ref HEAD', cwd, timeoutMs: gitTimeoutMs }).catch(() => undefined);
	const name = branch && branch.exitCode === 0 ? branch.stdout.trim() : '';

	return name === '' || name === 'HEAD' ? undefined : name;
};
