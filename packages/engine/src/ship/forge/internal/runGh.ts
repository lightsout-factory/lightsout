import { quoteShellArgument } from '#src/common/processes/quoteShellArgument.ts';
import { runCommand } from '#src/common/processes/runCommand.ts';
import type { CommandResult } from '#src/common/types/CommandResult.ts';
import { messageOf } from '#src/common/utils/messageOf.ts';

interface Params {
	/** Arguments after the `gh` word, each passed through untouched. */
	args: string[];
	cwd: string;
}

/**
 * Deliberately absent from the barrel, so swapping GitHub for another forge
 * stays a change inside `forge/`. A spawn failure or a blown deadline becomes
 * exit -1 carrying the message, so no caller needs a try/catch.
 */
export const runGh = async ({ args, cwd }: Params): Promise<CommandResult> => {
	const forgeTimeoutMs = 60_000;
	const command = ['gh', ...args.map((argument) => quoteShellArgument({ argument }))].join(' ');

	return runCommand({ command, cwd, timeoutMs: forgeTimeoutMs }).catch((error) => ({ exitCode: -1, stdout: '', stderr: messageOf({ error }) }));
};
