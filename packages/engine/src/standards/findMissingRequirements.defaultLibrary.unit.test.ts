import { join } from 'node:path';
import { describe, expect, test } from '@jest/globals';
import { findMissingRequirements } from '#src/standards/findMissingRequirements.ts';
import { readStandardsLibrary } from '#src/standardsLibraries/readStandardsLibrary.ts';
import { resolveStandardsPack } from '#src/standardsLibraries/resolveStandardsPack.ts';

/** The requires lists the lightsout rules declare, stated here as the contract their rule.md headers must meet. */
const listedRequires: Record<string, string[]> = {
	'lightsout/component-file-structure': [
		'lightsout/folder-index-file',
		'lightsout/module-folder-layout',
		'lightsout/single-file-domain-folder',
		'lightsout/ungrouped-domain-utils',
	],
	'lightsout/react-domain-folders': ['lightsout/folder-index-file', 'lightsout/module-out-of-common', 'lightsout/ungrouped-domain-utils'],
	'lightsout/file-naming-conventions': ['lightsout/filename-mismatch', 'lightsout/folder-casing'],
	'lightsout/feature-structure': [
		'lightsout/component-file-structure',
		'lightsout/folder-index-file',
		'lightsout/query-options',
		'lightsout/server-functions',
		'lightsout/shared-code-placement',
		'lightsout/ungrouped-domain-utils',
	],
	'lightsout/server-functions': ['lightsout/ungrouped-domain-utils'],
	'lightsout/file-naming-for-server-functions': ['lightsout/filename-mismatch'],
	'lightsout/query-options': ['lightsout/module-out-of-common', 'lightsout/ungrouped-domain-utils'],
	'lightsout/tanstack-hooks': ['lightsout/file-naming-conventions'],
	'lightsout/class-graduation': ['lightsout/module-file-to-folder'],
	'lightsout/discriminant-const-object': ['lightsout/bare-string-union'],
	'lightsout/module-boundary-testing': ['lightsout/files-that-must-not-have-dedicated-tests'],
	'lightsout/test-file-size': ['lightsout/module-boundary-testing'],
	'lightsout/folder-casing': ['lightsout/case-collision'],
	'lightsout/case-collision': ['lightsout/folder-casing'],
	'lightsout/duplicate-code-block': ['lightsout/class-inheritance', 'lightsout/thin-wrapper-functions'],
	'lightsout/reuse-common-code': ['lightsout/shared-code-placement'],
};

/**
 * The shipped built-in library, loaded from its authored folder — not the copy
 * under plugin/, which would pass or fail on whether someone had regenerated it.
 * Anchored on this file rather than on process.cwd().
 */
const setupDefaultLibrary = async () => {
	const library = await readStandardsLibrary({ packPath: join(__dirname, '..', '..', '..', 'lightsout-standards') });

	return { library, libraries: [library] };
};

describe('findMissingRequirements on the shipped lightsout library', () => {
	test('every combined lightsout pack sends each rule its rules require', async () => {
		const { libraries } = await setupDefaultLibrary();
		const addresses = ['lightsout/node', 'lightsout/react-app', 'lightsout/tanstack-start-app', 'lightsout/nestjs-app', 'lightsout/react'];

		const missingByPack = Object.fromEntries(
			addresses.map((address) => [address, findMissingRequirements({ rules: resolveStandardsPack({ address, libraries }).rules })]),
		);

		expect(missingByPack).toStrictEqual({
			'lightsout/node': [],
			'lightsout/react-app': [],
			'lightsout/tanstack-start-app': [],
			'lightsout/nestjs-app': [],
			// the react topic pack alone holds none of the structure and file-naming rules its rules point at
			'lightsout/react': [
				{ rule: 'lightsout/component-file-structure', required: 'lightsout/folder-index-file' },
				{ rule: 'lightsout/component-file-structure', required: 'lightsout/module-folder-layout' },
				{ rule: 'lightsout/component-file-structure', required: 'lightsout/single-file-domain-folder' },
				{ rule: 'lightsout/component-file-structure', required: 'lightsout/ungrouped-domain-utils' },
				{ rule: 'lightsout/file-naming-conventions', required: 'lightsout/filename-mismatch' },
				{ rule: 'lightsout/file-naming-conventions', required: 'lightsout/folder-casing' },
				{ rule: 'lightsout/react-domain-folders', required: 'lightsout/folder-index-file' },
				{ rule: 'lightsout/react-domain-folders', required: 'lightsout/module-out-of-common' },
				{ rule: 'lightsout/react-domain-folders', required: 'lightsout/ungrouped-domain-utils' },
			],
		});
	});

	test('the lightsout rules declare exactly the listed requires', async () => {
		const { library } = await setupDefaultLibrary();
		// every rule the library holds with an empty list, overlaid by the sixteen listed ones:
		// a listed rule the library lacks adds a key the loaded map cannot match
		const everyRuleEmpty = Object.fromEntries(library.rules.map((rule) => [rule.name, []]));

		const requiresByRule = Object.fromEntries(library.rules.map((rule) => [rule.name, rule.requires]));

		expect(requiresByRule).toStrictEqual({ ...everyRuleEmpty, ...listedRequires });
	});
});
