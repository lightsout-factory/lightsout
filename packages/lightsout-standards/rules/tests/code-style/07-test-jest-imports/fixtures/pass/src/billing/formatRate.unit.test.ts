import { expect, describe, test } from '@jest/globals';
import { formatRate } from './formatRate';

// Correct: the Jest import is first, and names only what the file uses.
describe('formatRate', () => {
	test('formats a rate as a percentage', () => {
		const rate = formatRate({ value: 0.2 });

		expect(rate).toBe('20%');
	});
});
