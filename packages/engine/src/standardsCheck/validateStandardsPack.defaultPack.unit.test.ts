import { join } from 'node:path';
import { describe, expect, test } from '@jest/globals';
import { validateStandardsPack } from '#src/standardsCheck/validateStandardsPack.ts';
import { readStandardsPack } from '#src/standardsPacks/readStandardsPack.ts';

/**
 * The shipped default pack, so the validator runs every rule's real check
 * against that rule's real fixtures — the files its rule page shows as examples.
 */
const setupDefaultPack = async () => {
	// The authored pack, anchored on this file — not its build copy under
	// plugin/, which would pass or fail on whether someone had run `pnpm bundle`.
	const pack = await readStandardsPack({ packPath: join(__dirname, '..', '..', '..', 'standards-typescript') });

	return { pack };
};

describe('validateStandardsPack on the shipped default pack', () => {
	// One test over the whole pack rather than one per rule: every problem line
	// starts with the rule's id, so a failure already names each rule that broke
	// and how, and the pack is loaded once.
	test('every check flags its fail fixture and leaves its pass fixture alone, and every rule’s fixtures match the example shape it declares', async () => {
		const { pack } = await setupDefaultPack();

		const { problems, notes } = await validateStandardsPack({ pack });

		// A rule skipped for want of a TypeScript to parse with would pass here
		// without having been checked, so a skip fails the test too.
		expect({ problems, skipped: notes.filter((note) => note.includes('not validated')) }).toStrictEqual({ problems: [], skipped: [] });
	});
});
