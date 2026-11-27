import { describe, expect, test } from '@jest/globals';
import { pollWhileLive } from '#src/utils/pollWhileLive.ts';

describe('pollWhileLive', () => {
	test.each([
		{ live: true, expected: 5000 },
		{ live: false, expected: false },
	])('polls every five seconds while live and not at all otherwise', ({ live, expected }) => {
		const interval = pollWhileLive({ live });

		expect(interval).toBe(expected);
	});

	test.each([
		{ live: true, intervalMs: undefined, expected: 5000 },
		{ live: true, intervalMs: 30_000, expected: 30_000 },
		{ live: false, intervalMs: undefined, expected: false },
		{ live: false, intervalMs: 30_000, expected: false },
	])('polls at five seconds by default and at the interval it is given', ({ live, intervalMs, expected }) => {
		const interval = pollWhileLive({ live, intervalMs });

		expect(interval).toBe(expected);
	});
});
