import { expect, describe, test } from '@jest/globals';
import { getLabel } from './getLabel';

// Right: a new test file follows the rules. It covers what the older test it
// mirrors covers, and takes none of that test's structure.
const setupLabel = ({ name = ' Ada ' }: { name?: string } = {}) => {
	return { name };
};

describe('getLabel', () => {
	test('trims the name it is given', () => {
		const { name } = setupLabel();

		const label = getLabel({ name });

		expect(label).toBe('Ada');
	});
});
