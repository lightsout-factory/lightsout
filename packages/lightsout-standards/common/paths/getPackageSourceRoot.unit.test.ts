import { describe, expect, test } from '@jest/globals';
import { getPackageSourceRoot } from './getPackageSourceRoot.ts';

describe('getPackageSourceRoot', () => {
	test('names the root src/ when the repo declares no workspace package', () => {
		const sourceRoot = getPackageSourceRoot({ path: 'src/billing/helpers', packageDirectories: ['.'] });

		expect(sourceRoot).toBe('src/');
	});

	test('names the src/ of the package holding the path', () => {
		const sourceRoot = getPackageSourceRoot({ path: 'packages/web/src/billing', packageDirectories: ['.', 'packages/web', 'packages/api'] });

		expect(sourceRoot).toBe('packages/web/src/');
	});

	test('takes the nearest package when one sits inside another', () => {
		const sourceRoot = getPackageSourceRoot({
			path: 'packages/web/plugins/chart/src/axes',
			packageDirectories: ['packages/web', 'packages/web/plugins/chart'],
		});

		expect(sourceRoot).toBe('packages/web/plugins/chart/src/');
	});

	test('falls back to the root src/ for a path no declared package holds', () => {
		const sourceRoot = getPackageSourceRoot({ path: 'scripts/build', packageDirectories: ['packages/web'] });

		expect(sourceRoot).toBe('src/');
	});
});
