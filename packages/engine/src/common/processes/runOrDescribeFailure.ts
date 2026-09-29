import { gitTimeoutMs } from '#src/common/constants/gitTimeoutMs.ts';
import { runCommand } from '#src/common/processes/runCommand.ts';

interface Params {
	command: string;
	cwd: string;
	/** Defaults to the git ceiling, which is what almost every step running through this runs under. */
	timeoutMs?: number;
	/** What to call the thing that ran, for the case where it never answered at all. */
	subject?: string;
}

/** @returns the command's trimmed stderr when it failed, or `undefined` when it worked */
export const runOrDescribeFailure = async ({ command, cwd, timeoutMs = gitTimeoutMs, subject = 'git' }: Params): Promise<string | undefined> => {
	const result = await runCommand({ command, cwd, timeoutMs }).catch(() => undefined);

	return result?.exitCode === 0 ? undefined : (result?.stderr ?? `${subject} did not answer`).trim();
};
