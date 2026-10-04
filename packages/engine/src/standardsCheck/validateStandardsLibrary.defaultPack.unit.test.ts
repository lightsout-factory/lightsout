import { join } from 'node:path';
import { describe, expect, test } from '@jest/globals';
import { validateStandardsLibrary } from '#src/standardsCheck/validateStandardsLibrary.ts';
import { readStandardsLibrary } from '#src/standardsLibraries/readStandardsLibrary/readStandardsLibrary.ts';

/**
 * The shipped default pack, so the validator runs every rule's real check
 * against that rule's real fixtures — the files its rule page shows as examples.
 */
const setupDefaultPack = async () => {
	// The authored pack, anchored on this file — not its build copy under
	// plugin/, which would pass or fail on whether someone had run `pnpm bundle`.
	const pack = await readStandardsLibrary({ packPath: join(__dirname, '..', '..', '..', 'lightsout-standards') });

	return { pack };
};

describe('validateStandardsLibrary on the shipped default pack', () => {
	// One test over the whole pack rather than one per rule: every problem line
	// starts with the rule's id, so a failure already names each rule that broke
	// and how, and the pack is loaded once.
	test('every check flags its fail fixture and leaves its pass fixture alone, and every rule’s fixtures match the example shape it declares', async () => {
		const { pack } = await setupDefaultPack();

		const { problems, notes } = await validateStandardsLibrary({ library: pack, libraries: [pack] });

		// A rule skipped for want of a TypeScript to parse with would pass here
		// without having been checked, so a skip fails the test too.
		expect({ problems, skipped: notes.filter((note) => note.includes('not validated')) }).toStrictEqual({ problems: [], skipped: [] });
	});

	// Every rule with default options is listed with its exact caps, so a rule
	// whose check reads a cap but loads with empty options fails here too.
	test('every rule whose check reads a cap loads that cap as a default option', async () => {
		const { pack } = await setupDefaultPack();

		const rulesWithOptions = pack.rules.filter((rule) => Object.keys(rule.defaultOptions).length > 0);
		const optionsByRule = Object.fromEntries(rulesWithOptions.map((rule) => [rule.id, rule.defaultOptions]));

		expect(optionsByRule).toStrictEqual({
			'file-size': { file: 250 },
			'function-size': { function: 80 },
			'react-function-size': { function: 80, hook: 160, component: 200 },
			'folder-size': { cap: 20 },
			'common-folder-layout': { cap: 20 },
			'test-file-size': { testFile: 400 },
			'duplicate-code-block': { minTokens: 50 },
			'duplicate-function-body': { minBodyTokens: 40 },
		});
	});
});
