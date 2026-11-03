import { describe, expect, test } from '@jest/globals';
import { getSourceRelativePath } from './getSourceRelativePath.ts';

describe('getSourceRelativePath', () => {
	test.each([
		{ path: 'src/features/issues/screens/IssuesScreen.tsx', packageDirectories: ['.'], expected: 'features/issues/screens/IssuesScreen.tsx' },
		{ path: 'packages/web-app/src/components/ui/Button.tsx', packageDirectories: ['packages/web-app'], expected: 'components/ui/Button.tsx' },
		{ path: 'src/features', packageDirectories: ['.'], expected: 'features' },
	])('strips the package prefix and src/ from $path', ({ path, packageDirectories, expected }) => {
		expect(getSourceRelativePath({ path, packageDirectories })).toBe(expected);
	});

	test.each([
		{ path: 'tests/helpers/renderWithRouter.tsx', packageDirectories: ['.'] },
		{ path: 'packages/web-app/tests/stub.tsx', packageDirectories: ['packages/web-app'] },
		{ path: 'src', packageDirectories: ['.'] },
	])('answers undefined for $path, which sits outside every source tree', ({ path, packageDirectories }) => {
		expect(getSourceRelativePath({ path, packageDirectories })).toBeUndefined();
	});
});
