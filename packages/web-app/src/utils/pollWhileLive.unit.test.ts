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
});
