import { describe, expect, test } from '@jest/globals';
import { getOwningPackage } from './getOwningPackage.ts';

describe('getOwningPackage', () => {
	test.each([
		{ path: 'packages/api/src/run.ts', expected: 'packages/api' },
		{ path: 'packages/api/tools/src/run.ts', expected: 'packages/api/tools' },
		{ path: 'packages/apiary/src/run.ts', expected: '.' },
		{ path: 'scripts/build.ts', expected: '.' },
	])('names the nearest package holding $path', ({ path, expected }) => {
		const owner = getOwningPackage({ path, packageDirectories: ['.', 'packages/api', 'packages/api/tools'] });

		expect(owner).toBe(expected);
	});

	test('answers undefined for a path no declared package holds', () => {
		const owner = getOwningPackage({ path: 'scripts/build.ts', packageDirectories: ['packages/api'] });

		expect(owner).toBeUndefined();
	});
});
