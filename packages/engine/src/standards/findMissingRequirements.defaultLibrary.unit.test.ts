import { join } from 'node:path';
import { describe, expect, test } from '@jest/globals';
import { findMissingRequirements } from '#src/standards/findMissingRequirements.ts';
import { readStandardsLibrary } from '#src/standardsLibraries/readStandardsLibrary.ts';
import { resolveStandardsPack } from '#src/standardsLibraries/resolveStandardsPack.ts';

/** The requires lists the lightsout rules declare, stated here as the contract their rule.md headers must meet. */
const listedRequires: Record<string, string[]> = {
	'lightsout/component-file-structure': ['lightsout/index-files', 'lightsout/module-folder-layout'],
	'lightsout/feature-structure': [
		'lightsout/component-file-structure',
		'lightsout/index-files',
		'lightsout/query-options',
		'lightsout/server-functions',
		'lightsout/shared-code-placement',
	],
	'lightsout/file-naming-for-server-functions': ['lightsout/filename-mismatch'],
	'lightsout/query-options': ['lightsout/module-folder-layout'],
	'lightsout/module-boundary-testing': ['lightsout/files-that-must-not-have-dedicated-tests'],
	'lightsout/test-file-size': ['lightsout/module-boundary-testing'],
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
	test('lightsout/standards and each goal pack send every rule their rules require, and a framework pack selected alone does not', async () => {
		const { libraries } = await setupDefaultLibrary();
		const addresses = [
			'lightsout/standards',
			'lightsout/fractal',
			'lightsout/agent-corrections',
			'lightsout/code-style',
			'lightsout/nestjs',
			'lightsout/react',
			'lightsout/tanstack-start',
		];

		const missingByPack = Object.fromEntries(
			addresses.map((address) => [
				address,
				findMissingRequirements({ rules: resolveStandardsPack({ addresses: [address], libraries, dependencies: undefined }).rules }),
			]),
		);

		expect(missingByPack).toStrictEqual({
			'lightsout/standards': [],
			'lightsout/fractal': [],
			'lightsout/agent-corrections': [],
			'lightsout/code-style': [],
			// the nestjs pack holds a topic and no rule, so nothing in it requires anything
			'lightsout/nestjs': [],
			// the react pack alone holds none of the fractal rules its rule points at
			'lightsout/react': [
				{ rule: 'lightsout/component-file-structure', required: 'lightsout/index-files' },
				{ rule: 'lightsout/component-file-structure', required: 'lightsout/module-folder-layout' },
			],
			// the tanstack-start pack alone holds neither the fractal rules nor the react rule its rules point at
			'lightsout/tanstack-start': [
				{ rule: 'lightsout/feature-structure', required: 'lightsout/component-file-structure' },
				{ rule: 'lightsout/feature-structure', required: 'lightsout/index-files' },
				{ rule: 'lightsout/feature-structure', required: 'lightsout/shared-code-placement' },
				{ rule: 'lightsout/file-naming-for-server-functions', required: 'lightsout/filename-mismatch' },
				{ rule: 'lightsout/query-options', required: 'lightsout/module-folder-layout' },
			],
		});
	});

	test('the lightsout rules declare exactly the listed requires', async () => {
		const { library } = await setupDefaultLibrary();
		// every rule the library holds with an empty list, overlaid by the eight listed ones:
		// a listed rule the library lacks adds a key the loaded map cannot match
		const everyRuleEmpty = Object.fromEntries(library.rules.map((rule) => [rule.name, []]));

		const requiresByRule = Object.fromEntries(library.rules.map((rule) => [rule.name, rule.requires]));

		expect(requiresByRule).toStrictEqual({ ...everyRuleEmpty, ...listedRequires });
	});
});
