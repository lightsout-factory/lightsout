import { describe, expect, test } from '@jest/globals';
import { StandardsPackSource } from '#src/contracts/standards/StandardsPackSource.ts';
import type { StandardsGroup } from '#src/standards/common/types/StandardsGroup.ts';
import { findFileStandardsGroup } from '#src/standardsCheck/internal/common/utils/findFileStandardsGroup.ts';

const buildGroup = ({ packages, pack }: { packages: string[]; pack: string }): StandardsGroup => ({
	packages,
	pack: { name: pack, topics: [], rules: [] },
	source: StandardsPackSource.Named,
	states: new Map(),
});

const setupGroups = ({ rootPackages }: { rootPackages: string[] }) => {
	const rootGroup = buildGroup({ packages: rootPackages, pack: 'lightsout/node' });
	const webAppGroup = buildGroup({ packages: ['web-app'], pack: 'lightsout/react-app' });

	return { rootGroup, webAppGroup, groups: [rootGroup, webAppGroup] };
};

describe('findFileStandardsGroup', () => {
	test("returns the group holding the file's package, and the root group for a file outside the packages directory or no file", () => {
		const { rootGroup, webAppGroup, groups } = setupGroups({ rootPackages: ['', 'engine'] });
		const find = (file: string | undefined) => findFileStandardsGroup({ file, groups, packagesDir: 'packages', workspacePackages: ['engine', 'web-app'] });

		const found = {
			webAppFile: find('packages/web-app/src/App.tsx'),
			engineFile: find('packages/engine/src/index.ts'),
			rootFile: find('scripts/build.mjs'),
			noFile: find(undefined),
		};

		expect(found).toStrictEqual({
			webAppFile: webAppGroup,
			engineFile: rootGroup,
			rootFile: rootGroup,
			noFile: rootGroup,
		});
	});

	test('treats a folder that is not a workspace package as the repo root, and answers undefined for a package no group holds', () => {
		const { rootGroup, groups } = setupGroups({ rootPackages: [''] });
		const find = (file: string) => findFileStandardsGroup({ file, groups, packagesDir: 'packages', workspacePackages: ['engine', 'web-app'] });

		const found = {
			notWorkspaceFolder: find('packages/tools/src/run.ts'),
			ungroupedPackage: find('packages/engine/src/index.ts'),
		};

		expect(found).toStrictEqual({
			notWorkspaceFolder: rootGroup,
			ungroupedPackage: undefined,
		});
	});

	test('gives a path equal to a package folder to that package', () => {
		const { rootGroup, webAppGroup, groups } = setupGroups({ rootPackages: [''] });
		const find = (file: string) => findFileStandardsGroup({ file, groups, packagesDir: 'packages', workspacePackages: ['engine', 'web-app'] });

		const found = {
			packageFolder: find('packages/web-app'),
			nonWorkspaceFolder: find('packages/tools'),
		};

		expect(found).toStrictEqual({
			packageFolder: webAppGroup,
			nonWorkspaceFolder: rootGroup,
		});
	});
});
