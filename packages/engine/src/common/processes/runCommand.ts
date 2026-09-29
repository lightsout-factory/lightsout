import { spawn } from 'node:child_process';
import { collectChildOutput } from '#src/common/processes/collectChildOutput.ts';
import type { CommandResult } from '#src/common/types/CommandResult.ts';

interface Params {
	/** Full shell command from consumer config (e.g. `pnpm --filter api check`). */
	command: string;
	cwd: string;
	timeoutMs?: number;
	/** Entries merged over the inherited environment — how the engine reaches a child process it does not own the command of. */
	env?: Record<string, string>;
	/** Called once with the spawned shell's pid, which is also its process-group id because the spawn is detached. */
	onSpawn?: ({ pid }: { pid: number }) => void;
	/** Called once when `timeoutMs` fires, before the promise rejects. */
	onTimeout?: () => void;
}

/**
 * Rejects only on spawn failure or timeout; a non-zero exit is a result, not an
 * exception. `onTimeout` is how a caller tells the two rejections apart.
 */
export const runCommand = ({ command, cwd, timeoutMs, env, onSpawn, onTimeout }: Params): Promise<CommandResult> => {
	// `env` is passed explicitly because Jest hands test code a copy of
	// process.env that real child processes do not inherit, so a PATH-stubbing
	// test would otherwise probe the machine instead of its fixture.
	// `detached` makes the shell its own process-group leader, so a gate that
	// blows its deadline can be killed with the tree it started.
	const child = spawn(command, { cwd, shell: true, stdio: ['ignore', 'pipe', 'pipe'], env: env ? { ...process.env, ...env } : process.env, detached: true });

	// The only place the group id surfaces, and the shared gate reservation has
	// to record it while the command is still running.
	if (child.pid !== undefined) {
		onSpawn?.({ pid: child.pid });
	}

	return collectChildOutput({
		child,
		timeout: timeoutMs ? { ms: timeoutMs, message: `command timed out after ${timeoutMs}ms: ${command}` } : undefined,
		onTimeout,
	});
};
