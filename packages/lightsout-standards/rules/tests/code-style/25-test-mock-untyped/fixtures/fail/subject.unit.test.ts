import { expect, describe, test, jest } from '@jest/globals';

// Incorrect: no generic, so the mock accepts and returns anything.
const mockGetLocale = jest.fn();

const mockSaveOrder = jest.fn<(params: { id: string }) => string>();

// Incorrect: the wrapper is typed to discard what the real function takes.
jest.mock('@/orders/saveOrder', () => ({
	saveOrder: (...args: unknown[]) => mockSaveOrder(args[0] as { id: string }),
}));

describe('subject', () => {
	test('reads the locale and saves the order', () => {
		mockGetLocale.mockReturnValue('en-GB');
		mockSaveOrder.mockReturnValue('ok');

		expect(mockGetLocale() + mockSaveOrder({ id: 'a' })).toBe('en-GBok');
	});
});
