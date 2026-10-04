import { setTimeout as delay } from 'node:timers/promises';
import { StopProcessOutcome } from '#src/cli/stopCommand/common/constants/StopProcessOutcome.ts';
import { isRecordedProcessAlive } from '#src/runState/liveness/isRecordedProcessAlive.ts';

interface Params {
	pid: number;
	processStartTime?: string;
	graceMs?: number;
	pollMs?: number;
}

const SignalAnswer = {
	Sent: 'sent',
	Gone: 'gone',
	Refused: 'refused',
} as const;

/** ESRCH means the process is already gone; EPERM means it belongs to another user and cannot be signalled. */
const sendSignal = ({ pid, signal }: { pid: number; signal: NodeJS.Signals }) => {
	try {
		process.kill(pid, signal);

		return SignalAnswer.Sent;
	} catch (error) {
		const code = typeof error === 'object' && error !== null && 'code' in error ? error.code : undefined;

		if (code === 'ESRCH') {
			return SignalAnswer.Gone;
		}

		if (code === 'EPERM') {
			return SignalAnswer.Refused;
		}

		throw error;
	}
};

/** Whether the process is gone, or goes, within the window. */
const exitsWithin = async ({ pid, processStartTime, windowMs, pollMs }: { pid: number; processStartTime?: string; windowMs: number; pollMs: number }) => {
	const deadline = Date.now() + windowMs;
	let alive = await isRecordedProcessAlive({ pid, processStartTime });

	while (alive && Date.now() < deadline) {
		await delay(pollMs);
		alive = await isRecordedProcessAlive({ pid, processStartTime });
	}

	return !alive;
};

const escalate = async ({ pid, processStartTime, pollMs }: { pid: number; processStartTime?: string; pollMs: number }) => {
	const killed = sendSignal({ pid, signal: 'SIGKILL' });
	const confirmationMs = 1_000;
	let outcome: StopProcessOutcome = killed === SignalAnswer.Refused ? StopProcessOutcome.Refused : StopProcessOutcome.Exited;

	if (killed === SignalAnswer.Sent) {
		outcome = (await exitsWithin({ pid, processStartTime, windowMs: confirmationMs, pollMs })) ? StopProcessOutcome.Killed : StopProcessOutcome.Survived;
	}

	return outcome;
};

/**
 * Stops a process this process did not spawn, so it polls the pid rather than
 * awaiting an `exit` event. Only the pid itself is signalled, never its process
 * group: the engine's own SIGTERM handler is what stops its harness and gate
 * groups, and signalling them directly would bypass that relay and its
 * transcript flush. Every probe checks the recorded start time, so a pid reused
 * during the wait reads as exited rather than as the engine surviving.
 *
 * @param pid - the process to stop
 * @param processStartTime - the start time recorded for the process; when undefined only the pid is checked
 * @param graceMs - how long SIGTERM is given before SIGKILL
 * @param pollMs - the time between liveness probes
 * @throws {RangeError} When the pid is not a single positive process id, which `process.kill` would read as a process group
 */
export const stopProcess = async ({ pid, processStartTime, graceMs = 10_000, pollMs = 200 }: Params): Promise<StopProcessOutcome> => {
	if (!Number.isInteger(pid) || pid <= 0) {
		throw new RangeError(`refusing to signal pid ${pid}: only a single positive process id can be stopped`);
	}

	if (!(await isRecordedProcessAlive({ pid, processStartTime }))) {
		return StopProcessOutcome.Exited;
	}

	const terminated = sendSignal({ pid, signal: 'SIGTERM' });
	let outcome: StopProcessOutcome = StopProcessOutcome.Exited;

	if (terminated === SignalAnswer.Refused) {
		outcome = StopProcessOutcome.Refused;
	} else if (terminated === SignalAnswer.Sent && !(await exitsWithin({ pid, processStartTime, windowMs: graceMs, pollMs }))) {
		outcome = await escalate({ pid, processStartTime, pollMs });
	}

	return outcome;
};
