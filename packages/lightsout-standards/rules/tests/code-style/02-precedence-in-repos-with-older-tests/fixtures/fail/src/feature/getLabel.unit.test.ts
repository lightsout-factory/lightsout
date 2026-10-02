import { expect, describe, test, beforeEach } from '@jest/globals';
import { getLabel } from './getLabel';

// Wrong: a new test file written in the older style of the test it mirrors. A
// file you create follows the rules, whatever style the mirrored test uses.
let name: string;

describe('getLabel', () => {
	beforeEach(() => {
		name = ' Ada ';
	});

	test('trims the name it is given', () => {
		expect(getLabel({ name })).toBe('Ada');
	});
});
