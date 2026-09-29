import { runCommand } from '#src/common/processes/runCommand.ts';
import type { CommandResult } from '#src/common/types/CommandResult.ts';
import { messageOf } from '#src/common/utils/messageOf.ts';

interface Params {
	/** Arguments after the `gh` word, each passed through untouched. */
	args: string[];
	cwd: string;
}

/** One argument, safe to hand a shell: wrapped in single quotes, with any single quote of its own closed and re-opened around an escaped one. */
const quote = ({ argument }: { argument: string }) => `'${argument.split("'").join(`'\\''`)}'`;

/**
 * Deliberately absent from the barrel, so swapping GitHub for another forge
 * stays a change inside `forge/`. A spawn failure or a blown deadline becomes
 * exit -1 carrying the message, so no caller needs a try/catch.
 */
export const runGh = async ({ args, cwd }: Params): Promise<CommandResult> => {
	const forgeTimeoutMs = 60_000;
	const command = ['gh', ...args.map((argument) => quote({ argument }))].join(' ');

	return runCommand({ command, cwd, timeoutMs: forgeTimeoutMs }).catch((error) => ({ exitCode: -1, stdout: '', stderr: messageOf({ error }) }));
};
