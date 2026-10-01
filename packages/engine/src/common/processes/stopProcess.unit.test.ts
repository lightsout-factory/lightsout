import { type ChildProcess, spawn, spawnSync } from 'node:child_process';
import { constants } from 'node:os';
import { afterEach, describe, expect, jest, test } from '@jest/globals';
import { readProcessStartTime } from '#src/common/processes/readProcessStartTime.ts';
import { stopProcess } from '#src/common/processes/stopProcess.ts';

/** A pid no process on this machine holds: the spy-only cases never touch a real process. */
const fakePid = 4242;

/** A start time no process on this machine was started at. */
const otherStartTime = 'Thu Jan  1 00:00:00 1970';

/** Every child a test spawns, so one that a failed assertion left running is still killed. */
const spawnedChildren = new Set<ChildProcess>();

afterEach(() => {
	for (const child of spawnedChildren) {
		// ChildProcess.kill signals through the child's own handle, never through
		// a process.kill a test may still have spied
		child.kill('SIGKILL');
	}

	spawnedChildren.clear();
});

/** The name of a signal however it was passed; 0 is the liveness probe, not a signal. */
const signalName = ({ signal }: { signal?: string | number }) => {
	if (signal === 0) {
		return 'probe';
	}

	if (typeof signal === 'number') {
		return Object.entries(constants.signals).find(([, value]) => value === signal)?.[0];
	}

	return signal ?? 'SIGTERM';
};

/** Every call that actually sent a signal, as `[target, signal name]`, probes left out. */
const signalsSent = ({ kill }: { kill: { mock: { calls: [number, (string | number)?][] } } }) =>
	kill.mock.calls.map(([target, signal]) => [target, signalName({ signal })] as const).filter(([, name]) => name !== 'probe');

/**
 * A real node child the test owns, waiting until it is ready. When it traps
 * SIGTERM only SIGKILL can end it. `exited` settles once it has been reaped, so
 * its pid is gone by then.
 */
const spawnChild = async ({ trapsSigterm }: { trapsSigterm: boolean }) => {
	const trap = trapsSigterm ? "process.on('SIGTERM', () => {}); " : '';
	const child = spawn(process.execPath, ['-e', `${trap}console.log('ready'); setInterval(() => {}, 1_000);`], {
		stdio: ['ignore', 'pipe', 'ignore'],
	});
	spawnedChildren.add(child);
	const exited = new Promise<void>((resolve) => child.once('exit', () => resolve()));

	await new Promise((resolve) => child.stdout?.once('data', resolve));

	return { child, pid: child.pid ?? 0, exited };
};

/** A live child, its real start time, and a `process.kill` that still reaches the system but records every call. */
const setupLiveChild = async ({ trapsSigterm = false }: { trapsSigterm?: boolean } = {}) => {
	const { child, pid, exited } = await spawnChild({ trapsSigterm });
	const processStartTime = await readProcessStartTime({ pid });
	const kill = jest.spyOn(process, 'kill');

	return { child, pid, processStartTime, exited, kill };
};

/**
 * A `process.kill` that never reaches the system: probes answer that the pid is
 * alive, and each signal either is accepted or fails with the errno a test names.
 */
const setupSpiedKill = ({ sigtermErrno, sigkillErrno }: { sigtermErrno?: string; sigkillErrno?: string } = {}) => {
	const kill = jest.spyOn(process, 'kill').mockImplementation((_pid: number, signal?: string | number): true => {
		const errnoBySignal: Record<string, string | undefined> = { SIGTERM: sigtermErrno, SIGKILL: sigkillErrno };
		const errno = errnoBySignal[signalName({ signal }) ?? ''];

		if (errno !== undefined) {
			throw Object.assign(new Error(`kill ${errno}`), { code: errno });
		}

		return true;
	});

	return { kill };
};

describe('stopProcess', () => {
	test('stopProcess: answers exited when the process honours SIGTERM within the grace period', async () => {
		const { child, pid, processStartTime, exited, kill } = await setupLiveChild();

		const outcome = await stopProcess({ pid, processStartTime });
		await exited;

		expect({ outcome, endedBy: child.signalCode, signals: signalsSent({ kill }) }).toStrictEqual({
			outcome: 'exited',
			endedBy: 'SIGTERM',
			signals: [[pid, 'SIGTERM']],
		});
	});

	test('stopProcess: sends SIGKILL and answers killed when SIGTERM is ignored past the grace period', async () => {
		const { child, pid, processStartTime, exited } = await setupLiveChild({ trapsSigterm: true });

		const outcome = await stopProcess({ pid, processStartTime, graceMs: 300 });
		await exited;

		expect({ outcome, endedBy: child.signalCode }).toStrictEqual({ outcome: 'killed', endedBy: 'SIGKILL' });
	});

	test('stopProcess: answers exited for a pid that is already gone', async () => {
		const goneChild = spawnSync(process.execPath, ['-e', '']);

		const outcome = await stopProcess({ pid: goneChild.pid });

		// the system answers ESRCH for a pid nothing holds, which means the work is done
		expect(outcome).toBe('exited');
	});

	test('stopProcess: answers refused and sends nothing more when the system refuses the signal', async () => {
		const { kill } = setupSpiedKill({ sigtermErrno: 'EPERM' });

		const outcome = await stopProcess({ pid: fakePid, graceMs: 50, pollMs: 10 });

		// EPERM means the pid belongs to another user: escalating would be refused too
		expect({ outcome, signals: signalsSent({ kill }) }).toStrictEqual({ outcome: 'refused', signals: [[fakePid, 'SIGTERM']] });
	});

	test('stopProcess: answers survived when the process is still alive after SIGKILL', async () => {
		setupSpiedKill();

		const outcome = await stopProcess({ pid: fakePid, graceMs: 50, pollMs: 10 });

		expect(outcome).toBe('survived');
	});

	test('stopProcess: signals the engine pid rather than its process group', async () => {
		const { kill } = setupSpiedKill();

		await stopProcess({ pid: fakePid, graceMs: 50, pollMs: 10 });

		// the engine's own SIGTERM handler stops its agent and gate groups; signalling
		// the group directly would bypass that relay and its transcript flush
		expect(signalsSent({ kill })).toStrictEqual([
			[fakePid, 'SIGTERM'],
			[fakePid, 'SIGKILL'],
		]);
	});

	test('stopProcess: treats a pid whose start time no longer matches as already gone', async () => {
		const { child, pid, kill } = await setupLiveChild();
		const started = Date.now();

		const outcome = await stopProcess({ pid, processStartTime: otherStartTime });

		// a reused pid belongs to some other process, which must never be signalled
		expect({
			outcome,
			signals: signalsSent({ kill }),
			answeredAtOnce: Date.now() - started < 5_000,
			stillRunning: child.exitCode === null && child.signalCode === null,
		}).toStrictEqual({ outcome: 'exited', signals: [], answeredAtOnce: true, stillRunning: true });
	});

	test('stopProcess: answers exited when the process ends between the probe and SIGTERM', async () => {
		const { kill } = setupSpiedKill({ sigtermErrno: 'ESRCH' });

		const outcome = await stopProcess({ pid: fakePid, graceMs: 50, pollMs: 10 });

		expect({ outcome, signals: signalsSent({ kill }) }).toStrictEqual({ outcome: 'exited', signals: [[fakePid, 'SIGTERM']] });
	});

	test.each([
		{ errno: 'ESRCH', expected: 'exited' },
		{ errno: 'EPERM', expected: 'refused' },
	])('stopProcess: answers $expected when SIGKILL meets $errno', async ({ errno, expected }) => {
		const { kill } = setupSpiedKill({ sigkillErrno: errno });

		const outcome = await stopProcess({ pid: fakePid, graceMs: 50, pollMs: 10 });

		expect({ outcome, signals: signalsSent({ kill }) }).toStrictEqual({
			outcome: expected,
			signals: [
				[fakePid, 'SIGTERM'],
				[fakePid, 'SIGKILL'],
			],
		});
	});

	test('stopProcess: rethrows a signal error that is neither ESRCH nor EPERM', async () => {
		setupSpiedKill({ sigtermErrno: 'EINVAL' });

		const stopped = stopProcess({ pid: fakePid, graceMs: 50, pollMs: 10 });

		await expect(stopped).rejects.toThrow('kill EINVAL');
	});

	test.each([{ pid: 0 }, { pid: -fakePid }, { pid: 1.5 }])('stopProcess: refuses pid $pid, which is not a single process', async ({ pid }) => {
		const { kill } = setupSpiedKill();

		const stopped = stopProcess({ pid });

		// process.kill reads 0 and a negative pid as a process group
		await expect(stopped).rejects.toThrow(RangeError);
		expect(kill.mock.calls).toStrictEqual([]);
	});
});
