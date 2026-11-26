import { describe, expect, test } from '@jest/globals';
import type { ShippingProgress } from '#src/contracts/ship/ShippingProgress.ts';
import { isShippingProgressLive } from '#src/ship/progress/isShippingProgressLive.ts';

/** Beyond any OS pid range — `process.kill(pid, 0)` reports ESRCH, so the recording process reads as gone. */
const deadPid = 999_999_999;

const setupShippingProgress = ({ pid, endedAt }: { pid: number; endedAt?: string }) => {
	const progress: ShippingProgress = {
		branch: 'lo-7-ship',
		attempt: 1,
		maxAttempts: 3,
		pid,
		startedAt: '2026-09-10T10:05:00.000Z',
		updatedAt: '2026-09-10T10:11:00.000Z',
		...(endedAt === undefined ? {} : { endedAt }),
		steps: [],
	};

	return { progress };
};

describe('isShippingProgressLive', () => {
	test.each([
		{ pid: process.pid, endedAt: undefined, expected: true },
		{ pid: deadPid, endedAt: undefined, expected: false },
		{ pid: process.pid, endedAt: '2026-09-10T10:12:00.000Z', expected: false },
	])('a ship record is live only while it is unended and its recorded process lives', ({ pid, endedAt, expected }) => {
		const { progress } = setupShippingProgress({ pid, endedAt });

		const live = isShippingProgressLive({ progress });

		expect(live).toBe(expected);
	});
});
