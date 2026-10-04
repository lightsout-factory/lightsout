import { spawn } from 'node:child_process';
import { collectChildOutput } from '#src/common/processes/collectChildOutput.ts';
import type { CommandResult } from '#src/common/types/CommandResult.ts';

interface Params {
	command: string;
	args: string[];
	cwd: string;
	/** Written to the child's stdin, then closed. */
	stdinText?: string;
	timeoutMs?: number;
	/** Called per complete stdout line, empty lines skipped. Full stdout is still collected and returned. */
	onStdoutLine?: (line: string) => void;
}

/** Rejects only on spawn failure or timeout: an exit code is a result the caller interprets. */
export const spawnCollect = ({ command, args, cwd, stdinText, timeoutMs, onStdoutLine }: Params): Promise<CommandResult> => {
	// `env` is passed explicitly so a test can stub the harness binary: without
	// it, a test that empties PATH still spawns the real harness, which costs money.
	// `detached` gives the harness its own process group, so a timeout kills the
	// tools it spawned too.
	const child = spawn(command, args, { cwd, stdio: ['pipe', 'pipe', 'pipe'], env: process.env, detached: true });

	// Listeners attach before stdin is written, so a harness that answers
	// immediately cannot out-run the collector.
	const collected = collectChildOutput({
		child,
		timeout: timeoutMs ? { ms: timeoutMs, message: `${command} timed out after ${timeoutMs}ms` } : undefined,
		onStdoutLine,
	});

	// A harness that exits before draining stdin raises EPIPE, which the exit
	// code and stderr already report. Unhandled, it would crash the engine with
	// the run manifest still marked running.
	child.stdin?.on('error', () => {});

	if (stdinText !== undefined) {
		child.stdin?.write(stdinText);
	}

	child.stdin?.end();

	return collected;
};
