import { describe, expect, test } from '@jest/globals';
import { parseTicketNumber } from '#src/ticketTracker/internal/common/utils/parseTicketNumber.ts';

describe('parseTicketNumber', () => {
	test('reads the number under the configured prefix, whatever its case', () => {
		expect(parseTicketNumber({ identifier: 'lo-70', ticketPrefix: 'LO' })).toBe('70');
		expect(parseTicketNumber({ identifier: 'LO-71', ticketPrefix: 'lo' })).toBe('71');
	});

	test('names no ticket for another prefix, a missing number or a number that is not digits', () => {
		expect(parseTicketNumber({ identifier: 'ENG-70', ticketPrefix: 'LO' })).toBeUndefined();
		expect(parseTicketNumber({ identifier: 'LO', ticketPrefix: 'LO' })).toBeUndefined();
		expect(parseTicketNumber({ identifier: 'LO-7a', ticketPrefix: 'LO' })).toBeUndefined();
	});
});
