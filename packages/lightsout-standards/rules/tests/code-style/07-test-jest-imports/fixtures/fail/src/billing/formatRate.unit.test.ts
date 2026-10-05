import { formatRate } from './formatRate';
import { expect, describe, test, jest, beforeEach } from '@jest/globals';

// Incorrect: the Jest import is not first, and it brings in `jest` and
// `beforeEach`, which this file never uses.
describe('formatRate', () => {
	test('formats a rate as a percentage', () => {
		const rate = formatRate({ value: 0.2 });

		expect(rate).toBe('20%');
	});
});
