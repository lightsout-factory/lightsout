import type { ChildProcess } from 'node:child_process';
import { killGraceMs } from '#src/common/constants/killGraceMs.ts';
import { killProcessGroup } from '#src/common/processes/killProcessGroup.ts';
import { relayShutdownSignals } from '#src/common/processes/relayShutdownSignals.ts';
import type { CommandResult } from '#src/common/types/CommandResult.ts';

interface Params {
	/** An already-spawned child whose stdout and stderr are piped. */
	child: ChildProcess;
	/** Kill-and-reject deadline. Duration and message travel together so a timeout can never be armed without one. */
	timeout?: { ms: number; message: string };
	/** Called once per complete stdout line as it arrives (blank lines skipped). Full stdout is still collected and returned. */
	onStdoutLine?: (line: string) => void;
	/** Called once when the deadline fires, before the promise rejects — never on a normal close or a spawn error. */
	onTimeout?: () => void;
}

/**
 * A non-zero exit is a result, not an exception — only a spawn error or the
 * deadline rejects; a signalled death carries no code, so it reports -1.
 *
 * Every process the engine runs goes through here, so the settle rules are
 * written once rather than re-derived per caller.
 */
export const collectChildOutput = ({ child, timeout, onStdoutLine, onTimeout }: Params): Promise<CommandResult> => {
	return new Promise<CommandResult>((resolve, reject) => {
		let stdout = '';
		let stderr = '';
		let lineBuffer = '';

		// Chunks split anywhere, so a trailing partial line is held back until
		// the next chunk completes it — except on flush, where close has proven
		// no more is coming and the remainder is a whole line.
		const emitLines = ({ text, flush = false }: { text: string; flush?: boolean }) => {
			if (!onStdoutLine) {
				return;
			}

			lineBuffer += text;

			const lines = lineBuffer.split('\n');

			lineBuffer = flush ? '' : (lines.pop() ?? '');

			for (const line of lines) {
				if (line.trim()) {
					onStdoutLine(line);
				}
			}
		};

		// SIGTERM first, SIGKILL only if it is ignored: SIGKILL cannot be caught,
		// so leading with it denies the harness the chance to flush a transcript
		// or delete its temp files. The escalation timer is unref'd so a pending
		// SIGKILL can never be the reason a process lingers.
		const expire = () => {
			killProcessGroup({ child, signal: 'SIGTERM' });

			const escalation = setTimeout(() => killProcessGroup({ child, signal: 'SIGKILL' }), killGraceMs);

			escalation.unref();
			child.once('close', () => clearTimeout(escalation));
			onTimeout?.();
			reject(new Error(timeout?.message ?? 'timed out'));
		};

		const timer = timeout ? setTimeout(expire, timeout.ms) : undefined;
		const stopRelay = relayShutdownSignals({ child });

		child.stdout?.on('data', (chunk: Buffer) => {
			const text = chunk.toString();

			stdout += text;
			emitLines({ text });
		});

		child.stderr?.on('data', (chunk: Buffer) => {
			stderr += chunk.toString();
		});

		child.on('error', (error) => {
			clearTimeout(timer);
			stopRelay();
			reject(error);
		});

		child.on('close', (code) => {
			clearTimeout(timer);
			stopRelay();
			emitLines({ text: '', flush: true });
			resolve({ exitCode: code ?? -1, stdout, stderr });
		});
	});
};
