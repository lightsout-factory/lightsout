import { gitTimeoutMs } from '#src/common/constants/gitTimeoutMs.ts';
import { runCommand } from '#src/common/processes/runCommand.ts';
import type { CommandResult } from '#src/common/types/CommandResult.ts';

interface Params {
	command: string;
	cwd: string;
	/** Defaults to the git ceiling, which is what every local read here runs under. */
	timeoutMs?: number;
}

/**
 * Answers `undefined` rather than throwing when the process never answered: a thrown deadline in
 * the middle of an open merge would leave the branch half-integrated with nobody to put it back.
 */
export const runGit = ({ command, cwd, timeoutMs = gitTimeoutMs }: Params): Promise<CommandResult | undefined> =>
	runCommand({ command, cwd, timeoutMs }).catch(() => undefined);
