import type { SpawnOptions } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { appendFileSync, existsSync, fstatSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { format } from 'node:util';
import { afterEach, describe, expect, jest, test } from '@jest/globals';
import { launchDetached } from '#src/cli/common/detach/launchDetached.ts';
import { RunManifest } from '#src/contracts/run/RunManifest.ts';
import type { RunOwner } from '#src/contracts/run/RunOwner.ts';
import { RunStatus } from '#src/contracts/run/RunStatus.ts';
import { RunNotFoundError } from '#src/runState/RunNotFoundError.ts';
import { freshCwd } from '#tests/helpers/freshCwd.ts';

// Mocked Imports
// -------------------------
// The engine child is a scripted stand-in: a real detached engine would outlive
// the test, and only a script can place its records and its exit between two
// looks. The run's records are read through stubs counting every look, so a case
// decides after which look the child has started or ended. The launch log itself
// is a real file in a temp checkout.
const mockSpawn = jest.fn<(command: string, args: string[], options: SpawnOptions) => EventEmitter>();

jest.mock('node:child_process', () => ({
	spawn: (command: string, args: string[], options: SpawnOptions) => mockSpawn(command, args, options),
}));
// -------------------------
const mockReadRunOwner = jest.fn<(params: { cwd: string; runId: string }) => Promise<RunOwner | undefined>>();

jest.mock('#src/runState/owner/readRunOwner.ts', () => ({
	readRunOwner: (params: { cwd: string; runId: string }) => mockReadRunOwner(params),
}));
// -------------------------
const mockReadRunManifest = jest.fn<(params: { cwd: string; runId: string }) => Promise<RunManifest>>();

jest.mock('#src/runState/readRunManifest.ts', () => ({
	readRunManifest: (params: { cwd: string; runId: string }) => mockReadRunManifest(params),
}));
// -------------------------
const mockReadProcessStartTime = jest.fn<(params: { pid: number }) => Promise<string | undefined>>();

jest.mock('#src/common/processes/readProcessStartTime.ts', () => ({
	readProcessStartTime: (params: { pid: number }) => mockReadProcessStartTime(params),
}));
// -------------------------
// The temp checkout is no repository, so it is its own primary checkout.
const mockReadGitPrimaryCheckout = jest.fn<(params: { cwd: string }) => Promise<string | undefined>>();

jest.mock('#src/common/git/readGitPrimaryCheckout.ts', () => ({
	readGitPrimaryCheckout: (params: { cwd: string }) => mockReadGitPrimaryCheckout(params),
}));
// -------------------------

const runId = 'f1d2c3b4-a5e6-4f70-8a9b-0c1d2e3f4a5b';
const enginePid = 48213;
const engineStartTime = 'Wed Oct  1 09:00:00 2026';
const recordedAt = '2026-10-01T09:00:01.000Z';
const engineEntry = '/opt/lightsout/dist/main.mjs';
const nodeFlags = ['--conditions=development'];

// Platform is a non-writable property, which jest.replaceProperty cannot pin
// (see stopCommand.unit.test.ts), so one hook puts the real one back.
const realPlatform = process.platform;

const pinPlatform = ({ platform }: { platform: string }) => {
	Object.defineProperty(process, 'platform', { value: platform, writable: false, enumerable: true, configurable: true });
};

afterEach(() => {
	pinPlatform({ platform: realPlatform });
});

const manifest = RunManifest.parse({
	runId,
	createdAt: recordedAt,
	updatedAt: recordedAt,
	plan: 'plans/demo/plan.md',
	harness: 'claude-code',
	status: RunStatus.Running,
	currentStep: 'implement',
	steps: [],
	changedFiles: [],
	packages: [],
});

/** A chunk however it was written: a relayed log may arrive as bytes rather than text. */
const textOf = ({ chunk }: { chunk: string | Uint8Array }) => (typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8'));

/** Everything written to one stream, whether through console or the stream itself. */
const captureStream = ({ stream, consoleMethod }: { stream: NodeJS.WriteStream; consoleMethod: 'log' | 'error' }) => {
	const chunks: string[] = [];

	jest.spyOn(console, consoleMethod).mockImplementation((...args: unknown[]) => {
		chunks.push(`${format(...args)}\n`);
	});
	jest.spyOn(stream, 'write').mockImplementation((chunk: string | Uint8Array) => {
		chunks.push(textOf({ chunk }));

		return true;
	});

	return chunks;
};

/** The lines one captured stream printed, without the blanks its trailing newlines leave. */
const nonEmptyLines = ({ chunks }: { chunks: string[] }) =>
	chunks
		.join('')
		.split('\n')
		.filter((line) => line !== '');

/** The file a stdio entry writes to, read while the parent still holds its descriptor. */
const inodeOf = ({ entry }: { entry: unknown }) => (typeof entry === 'number' ? fstatSync(entry).ino : undefined);

interface LaunchScript {
	/** The records the run already holds before the child writes any — an earlier process's. */
	earlierOwner?: RunOwner;
	/** The owner record the child writes once it has started. */
	childOwner?: RunOwner;
	/** After how many reads of the run's records the child's own records are there; absent when it never starts. */
	startsAfterReads?: number;
	/** After how many reads the child ends; absent when it outlives the launch. */
	exitsAfterReads?: number;
	exitCode?: number;
	/** What the child writes to the launch log before it ends. */
	childOutput?: string;
	/** What an earlier launch of the same run id left in the log. */
	earlierOutput?: string;
	childStartTimeReadable?: boolean;
	spawnFails?: boolean;
	platform?: string;
}

const setupLaunch = async ({
	earlierOwner,
	childOwner = { pid: enginePid, processStartTime: engineStartTime, recordedAt },
	startsAfterReads,
	exitsAfterReads,
	exitCode = 0,
	childOutput = '',
	earlierOutput,
	childStartTimeReadable = true,
	spawnFails = false,
	platform = 'darwin',
}: LaunchScript = {}) => {
	const cwd = await freshCwd();
	const logPath = join(cwd, '.lightsout', 'launches', `${runId}.log`);
	const relayMailbox = join(cwd, '.lightsout', 'queue-relay');
	const stdout = captureStream({ stream: process.stdout, consoleMethod: 'log' });
	const stderr = captureStream({ stream: process.stderr, consoleMethod: 'error' });

	if (earlierOutput !== undefined) {
		mkdirSync(join(cwd, '.lightsout', 'launches'), { recursive: true });
		writeFileSync(logPath, earlierOutput);
	}

	pinPlatform({ platform });
	jest.replaceProperty(process, 'execArgv', nodeFlags);
	jest.replaceProperty(process, 'argv', [process.execPath, engineEntry]);
	mockReadGitPrimaryCheckout.mockResolvedValue(undefined);
	mockReadProcessStartTime.mockResolvedValue(childStartTimeReadable ? engineStartTime : undefined);

	const engine: EventEmitter & { exitCode: number | null } = Object.assign(new EventEmitter(), {
		pid: spawnFails ? undefined : enginePid,
		exitCode: null,
		signalCode: null,
		unref: jest.fn<() => void>(),
	});
	const finish = () => {
		appendFileSync(logPath, childOutput);
		engine.exitCode = exitCode;
		engine.emit('exit', exitCode, null);
		engine.emit('close', exitCode, null);
	};
	const spawned: Record<string, unknown>[] = [];

	mockSpawn.mockImplementation((command, args, options) => {
		const stdio = Array.isArray(options.stdio) ? options.stdio : [];

		spawned.push({
			command,
			args,
			cwd: options.cwd,
			detached: options.detached,
			stdin: stdio[0],
			outputInodes: [inodeOf({ entry: stdio[1] }), inodeOf({ entry: stdio[2] })],
			runIdVariable: options.env?.LIGHTSOUT_RUN_ID,
		});
		setImmediate(() => (spawnFails ? engine.emit('error', new Error(`spawn ${command} ENOENT`)) : engine.emit('spawn')));

		return engine;
	});

	let stored: { owner?: RunOwner; manifest?: RunManifest } = earlierOwner ? { owner: earlierOwner, manifest } : {};
	let reads = 0;
	let stdoutAtFirstLook = '';

	/** Answers from the records as they stand, then lets the script move on by one read. */
	const read = <T>({ answer }: { answer: (records: typeof stored) => T }) => {
		const records = stored;

		reads += 1;
		stdoutAtFirstLook = reads === 1 ? stdout.join('') : stdoutAtFirstLook;
		stored = startsAfterReads !== undefined && reads >= startsAfterReads ? { owner: childOwner, manifest } : stored;

		if (reads === exitsAfterReads) {
			setImmediate(finish);
		}

		if (records.manifest === undefined) {
			throw new RunNotFoundError(`No run found for id ${runId}`);
		}

		return answer(records);
	};

	mockReadRunOwner.mockImplementation(async () => read({ answer: (records) => records.owner }));
	mockReadRunManifest.mockImplementation(async () => read({ answer: () => manifest }));

	return {
		cwd,
		logPath,
		relayMailbox,
		spawned,
		stdout,
		stderr,
		lines: () => nonEmptyLines({ chunks: stdout }),
		reads: () => reads,
		firstLookStdout: () => stdoutAtFirstLook,
	};
};

describe('launchDetached', () => {
	test('launchDetached: re-runs the same command detached without --detach, with the run id in its environment and its output in the launch log', async () => {
		const { cwd, logPath, spawned } = await setupLaunch({ startsAfterReads: 1 });

		await launchDetached({ cwd, command: 'implement', args: ['--plan', 'plans/demo/plan.md', '--detach', '--no-worktree'], runId, pollMs: 1 });

		const logInode = statSync(logPath).ino;
		expect(spawned).toStrictEqual([
			{
				command: process.execPath,
				args: [...nodeFlags, engineEntry, 'implement', '--plan', 'plans/demo/plan.md', '--no-worktree'],
				cwd: process.cwd(),
				detached: true,
				stdin: 'ignore',
				outputInodes: [logInode, logInode],
				runIdVariable: runId,
			},
		]);
	});

	test("launchDetached: returns 0 and prints the run id and launch log once the child's own owner record and the manifest exist", async () => {
		const { cwd, stdout, lines } = await setupLaunch({ startsAfterReads: 3 });

		const exitCode = await launchDetached({ cwd, command: 'implement', args: ['--detach'], runId, pollMs: 1 });

		expect({ exitCode, startReport: lines().slice(1).join('\n') }).toEqual({ exitCode: 0, startReport: expect.stringContaining(runId) });
		expect(stdout.join('')).not.toMatch(new RegExp(`${enginePid}|mailbox`, 'i'));
	});

	test('launchDetached: a queue start also names the engine pid and the relay mailbox', async () => {
		const { cwd, relayMailbox, stdout } = await setupLaunch({ startsAfterReads: 2 });

		const exitCode = await launchDetached({ cwd, command: 'queue', args: ['--detach', '--file-relay'], runId, relayMailbox, pollMs: 1 });

		const printed = stdout.join('');
		expect({ exitCode, namesPid: printed.includes(String(enginePid)), namesMailbox: printed.includes(relayMailbox) }).toStrictEqual({
			exitCode: 0,
			namesPid: true,
			namesMailbox: true,
		});
	});

	test("launchDetached: an owner record left by an earlier process is not a start, so a resume's refusal is still relayed", async () => {
		const childOutput = `run ${runId} is still owned by pid 31337 — stop it with: lightsout stop --run ${runId}\n`;
		const { cwd, stderr, lines } = await setupLaunch({
			earlierOwner: { pid: 31337, processStartTime: 'Mon Sep 29 08:00:00 2026', recordedAt },
			exitsAfterReads: 4,
			exitCode: 1,
			childOutput,
		});

		const exitCode = await launchDetached({ cwd, command: 'resume', args: ['--run', runId, '--detach'], runId, pollMs: 1 });

		expect({ exitCode, relayed: stderr.join(''), stdoutLines: lines().length }).toStrictEqual({ exitCode: 1, relayed: childOutput, stdoutLines: 1 });
	});

	test('launchDetached: a run folder not created yet is a normal not-yet, never an error', async () => {
		const { cwd, stderr, reads } = await setupLaunch({ startsAfterReads: 8 });

		const exitCode = await launchDetached({ cwd, command: 'implement', args: ['--detach'], runId, pollMs: 1 });

		expect({ exitCode, errors: stderr.join(''), lookedRepeatedly: reads() >= 8 }).toStrictEqual({ exitCode: 0, errors: '', lookedRepeatedly: true });
	});

	test('launchDetached: a child that refuses before starting has its own log output relayed to stderr and its exit code returned', async () => {
		const childOutput = 'plan not found: plans/missing.md\n';
		const { cwd, stderr, lines } = await setupLaunch({
			earlierOutput: 'output of an earlier launch of this run\n',
			exitsAfterReads: 2,
			exitCode: 3,
			childOutput,
		});

		const exitCode = await launchDetached({ cwd, command: 'implement', args: ['--plan', 'plans/missing.md', '--detach'], runId, pollMs: 1 });

		expect({ exitCode, relayed: stderr.join(''), stdoutLines: lines() }).toEqual({
			exitCode: 3,
			relayed: childOutput,
			stdoutLines: [expect.stringContaining(`starting run ${runId}`)],
		});
	});

	test('launchDetached: a child that exits 0 without starting a run is reported as a failure with exit 1', async () => {
		const childOutput = 'nothing to implement\n';
		const { cwd, stderr } = await setupLaunch({ exitsAfterReads: 2, exitCode: 0, childOutput });

		const exitCode = await launchDetached({ cwd, command: 'implement', args: ['--detach'], runId, pollMs: 1 });

		expect({ exitCode, relayed: stderr.join('') }).toStrictEqual({ exitCode: 1, relayed: childOutput });
	});

	test('launchDetached: a child that started and finished between two looks still reads as started', async () => {
		// The first look finds nothing; the child then writes its records and ends
		// long before the next look is due, so only a look made when the exit is
		// observed can see the start.
		const { cwd, lines } = await setupLaunch({ startsAfterReads: 1, exitsAfterReads: 1, exitCode: 0 });

		const exitCode = await launchDetached({ cwd, command: 'implement', args: ['--detach'], runId, pollMs: 10_000 });

		expect({ exitCode, startReport: lines().slice(1).join('\n') }).toEqual({ exitCode: 0, startReport: expect.stringContaining(runId) });
	});

	test('launchDetached: an engine that cannot be spawned is reported at once with exit 1', async () => {
		const { cwd, stdout, stderr, reads } = await setupLaunch({ spawnFails: true });

		const exitCode = await launchDetached({ cwd, command: 'implement', args: ['--detach'], runId, pollMs: 1 });

		expect({ exitCode, failure: stderr.join(''), announced: stdout.join('').includes('starting run'), looks: reads() }).toEqual({
			exitCode: 1,
			failure: expect.stringContaining('ENOENT'),
			announced: false,
			looks: 0,
		});
	});

	test('launchDetached: names the run id and launch log at once, before the run has started', async () => {
		const { cwd, logPath, firstLookStdout } = await setupLaunch({ startsAfterReads: 3 });

		await launchDetached({ cwd, command: 'implement', args: ['--detach'], runId, pollMs: 1 });

		const announced = firstLookStdout();
		expect({ namesRun: announced.includes(`starting run ${runId}`), namesLog: announced.includes(logPath) }).toStrictEqual({ namesRun: true, namesLog: true });
	});

	test('launchDetached: an owner record whose pid matches but whose start time does not is not a start', async () => {
		const childOutput = 'refused: the run is owned by another process\n';
		const { cwd, stderr } = await setupLaunch({
			earlierOwner: { pid: enginePid, processStartTime: 'Thu Jan  1 00:00:00 1970', recordedAt },
			exitsAfterReads: 4,
			exitCode: 1,
			childOutput,
		});

		const exitCode = await launchDetached({ cwd, command: 'resume', args: ['--run', runId, '--detach'], runId, pollMs: 1 });

		expect({ exitCode, relayed: stderr.join('') }).toStrictEqual({ exitCode: 1, relayed: childOutput });
	});

	test.each([
		{ childStartTimeReadable: false, childOwner: { pid: enginePid, processStartTime: engineStartTime, recordedAt } },
		{ childStartTimeReadable: true, childOwner: { pid: enginePid, recordedAt } },
	])('launchDetached: the pid alone decides when either start time is unreadable', async ({ childStartTimeReadable, childOwner }) => {
		const { cwd } = await setupLaunch({ childStartTimeReadable, childOwner, startsAfterReads: 2 });

		const exitCode = await launchDetached({ cwd, command: 'implement', args: ['--detach'], runId, pollMs: 1 });

		expect(exitCode).toBe(0);
	});

	test('launchDetached: refuses on Windows before spawning anything', async () => {
		const { cwd, stderr, spawned } = await setupLaunch({ platform: 'win32' });

		const exitCode = await launchDetached({ cwd, command: 'implement', args: ['--detach'], runId, pollMs: 1 });

		expect({
			exitCode,
			refusal: nonEmptyLines({ chunks: stderr }),
			spawned: spawned.length,
			launchesFolder: existsSync(join(cwd, '.lightsout', 'launches')),
		}).toEqual({
			exitCode: 1,
			refusal: [expect.stringMatching(/POSIX.*macOS or Linux/)],
			spawned: 0,
			launchesFolder: false,
		});
	});
});
