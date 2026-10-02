import { expect, describe, test } from '@jest/globals';
import { getLabel } from './getLabel';

// Correct: the test sits beside `getLabel.ts` and is named after it.
describe('getLabel', () => {
	test('trims the name it is given', () => {
		const label = getLabel({ name: ' Ada ' });

		expect(label).toBe('Ada');
	});
});
