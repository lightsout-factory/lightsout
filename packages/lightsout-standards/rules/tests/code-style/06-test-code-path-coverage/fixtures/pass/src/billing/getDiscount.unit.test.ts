import { expect, describe, test } from '@jest/globals';
import { getDiscount } from './getDiscount';

// Correct: one test per path, and the inputs that share a path share one test.
describe('getDiscount', () => {
	test.each([
		{ total: 200, expected: 20 },
		{ total: 300, expected: 30 },
	])('discounts an order of $total', ({ total, expected }) => {
		const discount = getDiscount({ total });

		expect(discount).toBe(expected);
	});

	test('gives no discount under the threshold', () => {
		const discount = getDiscount({ total: 99 });

		expect(discount).toBe(0);
	});
});
