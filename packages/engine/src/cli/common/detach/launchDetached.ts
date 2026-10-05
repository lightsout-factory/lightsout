import { spawn } from 'node:child_process';
import { mkdir, open, readFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { launchRunIdVariable } from '#src/cli/common/constants/launchRunIdVariable.ts';
import { getLaunchLogPath } from '#src/cli/common/detach/getLaunchLogPath.ts';
import { messageOf } from '#src/common/messageOf.ts';
import { readProcessStartTime } from '#src/common/processes/readProcessStartTime.ts';
import { readRunOwner } from '#src/runState/owner/readRunOwner.ts';
import { readRunManifest } from '#src/runState/readRunManifest.ts';

interface Params {
	/** The launching checkout: where the launch log is kept and where the run's records are looked for. */
	cwd: string;
	/** The command the child runs — `implement`, `resume` or `queue`. */
	command: string;
	/** The command's own arguments as typed (`CommandContext['rest']`), `--detach` included; the caller has already added anything the child needs that was not typed. */
	args: string[];
	/** The id the child creates its run under, or the run it resumes. */
	runId: string;
	/** A detached queue's relay mailbox. When given, the start report also names the engine pid and this directory. */
	relayMailbox?: string;
	/** Milliseconds between looks for the run's records. */
	pollMs?: number;
}

/**
 * Started means the child's own owner record — its pid, and its start time when
 * both sides could read one — plus a readable manifest. Matching the child is
 * what stops a resume from taking the run's previous owner record, even one
 * whose pid the child has reused, for a start. A read that fails is "not yet":
 * the run folder may not exist yet, or the child may be mid-write.
 */
const hasStarted = async ({ cwd, runId, pid, startTime }: { cwd: string; runId: string; pid: number; startTime: string | undefined }) => {
	const owner = await readRunOwner({ cwd, runId }).catch(() => undefined);
	const recorded = owner !== undefined && 'pid' in owner ? owner : undefined;
	const ownsRun = recorded?.pid === pid && (startTime === undefined || recorded.processStartTime === undefined || recorded.processStartTime === startTime);
	const manifest = ownsRun ? await readRunManifest({ cwd, runId }).catch(() => undefined) : undefined;

	return manifest !== undefined;
};

/** The child's exit code, or undefined when the next look is due first. The losing timer is cancelled so it never holds the process open. */
const waitForExitOrLook = async ({ exited, pollMs }: { exited: Promise<number>; pollMs: number }) => {
	const controller = new AbortController();
	const look = delay(pollMs, undefined, { signal: controller.signal }).then(
		() => undefined,
		() => undefined,
	);
	const exitCode = await Promise.race([exited, look]);

	controller.abort();

	return exitCode;
};

/**
 * No timeout: the child's exit is the only other end of the wait. The start is
 * judged once more when the exit is observed, because a child that wrote its
 * records and finished between two looks did start.
 */
const waitForStart = async ({
	cwd,
	runId,
	pid,
	startTime,
	exited,
	pollMs,
}: {
	cwd: string;
	runId: string;
	pid: number;
	startTime: string | undefined;
	exited: Promise<number>;
	pollMs: number;
}) => {
	let exitCode: number | undefined;
	let started = await hasStarted({ cwd, runId, pid, startTime });

	while (!started && exitCode === undefined) {
		exitCode = await waitForExitOrLook({ exited, pollMs });
		started = await hasStarted({ cwd, runId, pid, startTime });
	}

	return { started, exitCode };
};

/** Only what this child wrote: a resume reuses the run id, so an earlier launch's output may already be in the file. */
const relayChildOutput = async ({ logPath, offset }: { logPath: string; offset: number }) => {
	const written = await readFile(logPath);

	process.stderr.write(written.subarray(offset));
};

const printStart = ({ runId, pid, relayMailbox }: { runId: string; pid: number; relayMailbox: string | undefined }) => {
	console.log(`run ${runId} has started`);

	if (relayMailbox !== undefined) {
		console.log(`engine pid: ${pid}`);
		console.log(`relay mailbox: ${relayMailbox}`);
	}
};

/**
 * Opens the log for append and spawns the engine on it. `--detach` is stripped
 * so the child runs the command in the foreground of its own session;
 * `process.execArgv` keeps the parent's Node flags, such as a dev loader.
 */
const spawnEngine = async ({ command, args, runId, logPath }: { command: string; args: string[]; runId: string; logPath: string }) => {
	await mkdir(dirname(logPath), { recursive: true });

	const log = await open(logPath, 'a');
	const { size: offset } = await log.stat();
	const child = spawn(process.execPath, [...process.execArgv, process.argv[1], command, ...args.filter((arg) => arg !== '--detach')], {
		cwd: process.cwd(),
		detached: true,
		stdio: ['ignore', log.fd, log.fd],
		env: { ...process.env, [launchRunIdVariable]: runId },
	});
	// Listened for before the spawn settles, so an engine that dies at once is never missed.
	const exited = new Promise<number>((resolve) => {
		child.once('exit', (code) => resolve(code ?? 1));
	});
	const spawnError = await new Promise<Error | undefined>((resolve) => {
		child.once('spawn', () => resolve(undefined));
		child.once('error', (error) => resolve(error));
	});

	await log.close();
	child.unref();

	return { child, exited, offset, spawnError };
};

/**
 * The parent side of `--detach`: spawns the engine detached on the same
 * command, then waits for the run's start or the child's exit. The parent
 * installs no signal handling, so interrupting the wait leaves the child running
 * in its own session.
 *
 * @returns the exit code the parent command exits with: 0 once the run has started, otherwise the child's own code (1 when it exited 0 without starting)
 */
export const launchDetached = async ({ cwd, command, args, runId, relayMailbox, pollMs = 500 }: Params): Promise<number> => {
	// A detached spawn there creates no new session and SIGTERM is
	// TerminateProcess, so the engine's shutdown relay could never run.
	if (process.platform === 'win32') {
		console.error('--detach needs a POSIX system (macOS or Linux)');
		return 1;
	}

	const logPath = await getLaunchLogPath({ cwd, runId });
	const { child, exited, offset, spawnError } = await spawnEngine({ command, args, runId, logPath });
	const pid = child.pid;

	if (spawnError !== undefined || pid === undefined) {
		console.error(`the lightsout engine could not be started: ${messageOf({ error: spawnError ?? 'no process id was assigned' })}`);
		return 1;
	}

	// At once, so a caller whose command is cut off mid-wait still holds the run id.
	console.log(`starting run ${runId} — engine output: ${logPath}`);

	const startTime = await readProcessStartTime({ pid });
	const { started, exitCode } = await waitForStart({ cwd, runId, pid, startTime, exited, pollMs });
	let code = 0;

	if (started) {
		printStart({ runId, pid, relayMailbox });
	} else {
		await relayChildOutput({ logPath, offset });
		code = exitCode === undefined || exitCode === 0 ? 1 : exitCode;
	}

	return code;
};
