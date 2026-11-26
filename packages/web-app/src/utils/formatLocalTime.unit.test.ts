import { describe, expect, test } from '@jest/globals';
import { formatLocalTime } from '#src/utils/formatLocalTime.ts';

// Built from local wall-clock parts, so the instant reads the same local time
// whatever time zone the suite runs in.
const setupInstant = () => {
	const iso = new Date(2026, 2, 7, 9, 5).toISOString();

	return { iso };
};

describe('formatLocalTime', () => {
	test('formats an ISO time as day, short month, year and a 24-hour local clock', () => {
		const { iso } = setupInstant();

		const formatted = formatLocalTime({ iso });

		expect(formatted).toBe('7 Mar 2026, 09:05');
	});
});
