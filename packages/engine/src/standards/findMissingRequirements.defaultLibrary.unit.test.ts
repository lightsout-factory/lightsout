import { join } from 'node:path';
import { describe, expect, test } from '@jest/globals';
import { findMissingRequirements } from '#src/standards/findMissingRequirements.ts';
import { readStandardsLibrary } from '#src/standardsLibraries/readStandardsLibrary.ts';
import { resolveStandardsPack } from '#src/standardsLibraries/resolveStandardsPack.ts';

/** The requires lists the lightsout rules declare, stated here as the contract their rule.md headers must meet. */
const listedRequires: Record<string, string[]> = {
	'lightsout/duplicate-export-name': ['lightsout/multi-export', 'lightsout/filename-mismatch'],
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
	test('lightsout/standards, each goal pack and each framework pack send every rule their rules require', async () => {
		const { libraries } = await setupDefaultLibrary();
		const addresses = ['lightsout/standards', 'lightsout/fractal', 'lightsout/code-style', 'lightsout/react', 'lightsout/tanstack-start'];

		const missingByPack = Object.fromEntries(
			addresses.map((address) => [
				address,
				findMissingRequirements({ rules: resolveStandardsPack({ addresses: [address], libraries, dependencies: undefined }).rules }),
			]),
		);

		expect(missingByPack).toStrictEqual({
			'lightsout/standards': [],
			'lightsout/fractal': [],
			'lightsout/code-style': [],
			// a framework pack's own rules require nothing
			'lightsout/react': [],
			'lightsout/tanstack-start': [],
		});
	});

	test('the lightsout rules declare exactly the listed requires', async () => {
		const { library } = await setupDefaultLibrary();
		// every rule the library holds with an empty list, overlaid by the listed ones:
		// a listed rule the library lacks adds a key the loaded map cannot match
		const everyRuleEmpty = Object.fromEntries(library.rules.map((rule) => [rule.name, []]));

		const requiresByRule = Object.fromEntries(library.rules.map((rule) => [rule.name, rule.requires]));

		expect(requiresByRule).toStrictEqual({ ...everyRuleEmpty, ...listedRequires });
	});
});
