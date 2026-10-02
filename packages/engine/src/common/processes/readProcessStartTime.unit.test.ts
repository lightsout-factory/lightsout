import { spawn } from 'node:child_process';
import { describe, expect, test } from '@jest/globals';
import { readProcessStartTime } from '#src/common/processes/readProcessStartTime.ts';

/** A child that has already exited and been reaped, so its pid names no process. */
const setupExitedChild = async () => {
	const child = spawn('true', [], { stdio: 'ignore' });

	await new Promise((resolve) => child.once('close', resolve));

	return { pid: child.pid ?? 0 };
};

/** Reads this process's start time while the caller's `TZ` is `timezone`, putting the caller's `TZ` back afterwards. */
const readUnderTimezone = async ({ timezone }: { timezone: string }) => {
	const callerTimezone = process.env.TZ;
	process.env.TZ = timezone;

	try {
		return await readProcessStartTime({ pid: process.pid });
	} finally {
		if (callerTimezone === undefined) {
			delete process.env.TZ;
		} else {
			process.env.TZ = callerTimezone;
		}
	}
};

describe('readProcessStartTime', () => {
	test('reads the same trimmed start time for a live process every time', async () => {
		const pid = process.pid;

		const first = await readProcessStartTime({ pid });
		const second = await readProcessStartTime({ pid });

		expect({
			isNonEmpty: (first ?? '').length > 0,
			isTrimmed: first === first?.trim(),
			second,
		}).toStrictEqual({ isNonEmpty: true, isTrimmed: true, second: first });
	});

	test('answers undefined for a pid with no process behind it', async () => {
		const { pid } = await setupExitedChild();

		const startTime = await readProcessStartTime({ pid });

		expect(startTime).toBe(undefined);
	});

	test('reads the same start time whatever timezone the caller runs under', async () => {
		const newYork = await readUnderTimezone({ timezone: 'America/New_York' });
		const tokyo = await readUnderTimezone({ timezone: 'Asia/Tokyo' });

		expect({ isRead: newYork !== undefined, tokyo }).toStrictEqual({ isRead: true, tokyo: newYork });
	});
});
