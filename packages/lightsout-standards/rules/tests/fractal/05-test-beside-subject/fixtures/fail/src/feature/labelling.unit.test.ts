import { expect, describe, test } from '@jest/globals';
import { getLabel } from './getLabel';

// Incorrect: no file named `labelling` sits in this folder, so the name does not say what this tests.
describe('getLabel', () => {
	test('trims the name it is given', () => {
		const label = getLabel({ name: ' Ada ' });

		expect(label).toBe('Ada');
	});
});
