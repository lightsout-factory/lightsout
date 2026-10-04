import { spawnSync } from 'node:child_process';
import { describe, expect, jest, test } from '@jest/globals';
import { isRecordedProcessAlive } from '#src/runState/liveness/isRecordedProcessAlive.ts';

// Mocked Imports
// -------------------------
// The real `ps` read answers every case but one: a live pid whose start time
// the operating system cannot report, which only a mock can produce on demand.
const mockReadProcessStartTime = jest.fn<(params: { pid: number }) => Promise<string | undefined>>();

jest.mock('#src/common/processes/readProcessStartTime.ts', () => ({
	readProcessStartTime: (params: { pid: number }) => mockReadProcessStartTime(params),
}));
// -------------------------

/** A start time no process on this machine was started at. */
const otherStartTime = 'Thu Jan  1 00:00:00 1970';

/** The real start-time read, so a recorded time and a live one come from the same source. */
const readActualStartTime = ({ pid }: { pid: number }) =>
	jest
		.requireActual<typeof import('#src/common/processes/readProcessStartTime.ts')>('#src/common/processes/readProcessStartTime.ts')
		.readProcessStartTime({ pid });

/**
 * Wire the start-time read to the operating system, or to one that cannot read
 * anything, and hand back this process's real start time alongside the pid of a
 * child that has already run to completion and been reaped.
 */
const setupRecordedProcess = async ({ startTimeReadable = true }: { startTimeReadable?: boolean } = {}) => {
	mockReadProcessStartTime.mockImplementation(startTimeReadable ? readActualStartTime : async () => undefined);

	const liveStartTime = await readActualStartTime({ pid: process.pid });
	const exitedPid = spawnSync(process.execPath, ['-e', '']).pid;

	return { liveStartTime, exitedPid };
};

describe('isRecordedProcessAlive', () => {
	test('matches a live pid only when its recorded start time is the live one', async () => {
		const { liveStartTime } = await setupRecordedProcess();

		const sameProcess = await isRecordedProcessAlive({ pid: process.pid, processStartTime: liveStartTime });
		const reusedPid = await isRecordedProcessAlive({ pid: process.pid, processStartTime: otherStartTime });

		expect({ sameProcess, reusedPid }).toStrictEqual({ sameProcess: true, reusedPid: false });
	});

	test('falls back to the pid alone when no start time was recorded and never revives a dead pid', async () => {
		const { liveStartTime, exitedPid } = await setupRecordedProcess();

		const unrecordedLive = await isRecordedProcessAlive({ pid: process.pid });
		const exitedWithStartTime = await isRecordedProcessAlive({ pid: exitedPid, processStartTime: liveStartTime });
		const exitedWithoutStartTime = await isRecordedProcessAlive({ pid: exitedPid });

		expect({ unrecordedLive, exitedWithStartTime, exitedWithoutStartTime }).toStrictEqual({
			unrecordedLive: true,
			exitedWithStartTime: false,
			exitedWithoutStartTime: false,
		});
	});

	test('falls back to the pid alone when the live start time cannot be read', async () => {
		await setupRecordedProcess({ startTimeReadable: false });

		const alive = await isRecordedProcessAlive({ pid: process.pid, processStartTime: otherStartTime });

		// an unreadable live start time means "unknown", never "a different process"
		expect(alive).toBe(true);
	});
});
