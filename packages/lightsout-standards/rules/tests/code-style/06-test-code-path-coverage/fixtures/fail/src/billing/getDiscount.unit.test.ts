import { expect, describe, test } from '@jest/globals';
import { getDiscount } from './getDiscount';

// Incorrect: two tests take the same path with different inputs, and the
// branch for an order under the threshold has no test at all.
describe('getDiscount', () => {
	test('discounts an order of 200', () => {
		const discount = getDiscount({ total: 200 });

		expect(discount).toBe(20);
	});

	test('discounts an order of 300', () => {
		const discount = getDiscount({ total: 300 });

		expect(discount).toBe(30);
	});
});
