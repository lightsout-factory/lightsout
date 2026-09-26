import { join } from 'node:path';
import { describe, expect, test } from '@jest/globals';
import { validateStandardsPack } from '#src/standardsCheck/validateStandardsPack.ts';
import { readStandardsPack } from '#src/standardsPacks/readStandardsPack.ts';

/**
 * The shipped default pack narrowed to one rule, so the validator runs that
 * rule's real check against that rule's real fixtures — the files its rule page
 * shows as examples.
 */
const setupDefaultPackRule = async ({ ruleId }: { ruleId: string }) => {
	// The authored pack, anchored on this file — not its build copy under
	// plugin/, which would pass or fail on whether someone had run `pnpm bundle`.
	const pack = await readStandardsPack({ packPath: join(__dirname, '..', '..', '..', 'standards-typescript') });

	return { pack: { ...pack, rules: pack.rules.filter((rule) => rule.id === ruleId) } };
};

describe('validateStandardsPack on the shipped default pack', () => {
	test('dead-export flags its fail fixture and leaves its pass fixture alone', async () => {
		const { pack } = await setupDefaultPackRule({ ruleId: 'dead-export' });

		const { problems } = await validateStandardsPack({ pack });

		expect({ rules: pack.rules.map((rule) => rule.id), problems }).toStrictEqual({ rules: ['dead-export'], problems: [] });
	});
});
