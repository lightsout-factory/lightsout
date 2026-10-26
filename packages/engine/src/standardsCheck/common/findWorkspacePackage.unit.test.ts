import { describe, expect, test } from '@jest/globals';
import { findWorkspacePackage } from '#src/standardsCheck/common/findWorkspacePackage.ts';

const setupWorkspace = () => {
	const find = (file: string) => findWorkspacePackage({ file, packagesDir: 'packages', workspacePackages: ['engine', 'web-app'] });

	return { find };
};

describe('findWorkspacePackage', () => {
	test('findWorkspacePackage: names the workspace package holding a file, or the package folder itself', () => {
		const { find } = setupWorkspace();

		const found = {
			packageFile: find('packages/web-app/src/a.ts'),
			packageFolder: find('packages/engine'),
		};

		expect(found).toStrictEqual({
			packageFile: 'web-app',
			packageFolder: 'engine',
		});
	});

	test('findWorkspacePackage: answers undefined outside the packages directory and for a folder that is not a workspace package', () => {
		const { find } = setupWorkspace();

		const found = {
			rootFile: find('src/a.ts'),
			notWorkspaceFolder: find('packages/scratch/a.ts'),
			barePackagesPrefix: find('packages/'),
		};

		expect(found).toStrictEqual({
			rootFile: undefined,
			notWorkspaceFolder: undefined,
			barePackagesPrefix: undefined,
		});
	});
});
