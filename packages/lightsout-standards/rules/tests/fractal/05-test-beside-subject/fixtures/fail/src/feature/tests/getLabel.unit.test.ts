import { expect, describe, test } from '@jest/globals';
import { getLabel } from '../getLabel';

// Incorrect: this test is filed into a separate folder, away from the file it tests.
describe('getLabel', () => {
	test('trims the name it is given', () => {
		const label = getLabel({ name: ' Ada ' });

		expect(label).toBe('Ada');
	});
});
