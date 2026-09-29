import { gitTimeoutMs } from '#src/common/constants/gitTimeoutMs.ts';
import { runCommand } from '#src/common/processes/runCommand.ts';

interface Params {
	cwd: string;
}

export const readGitHeadCommit = async ({ cwd }: Params): Promise<string | undefined> => {
	const head = await runCommand({ command: 'git rev-parse HEAD', cwd, timeoutMs: gitTimeoutMs }).catch(() => undefined);

	return head && head.exitCode === 0 ? head.stdout.trim() : undefined;
};
