import { describe, expect, test } from '@jest/globals';
import { defaultPackRuleQueryOptions } from '#src/features/packs/queries/defaultPackRuleQueryOptions.ts';
import { defaultPackQueryOptions } from '#src/queries/defaultPackQueryOptions.ts';

describe('defaultPackQueryOptions', () => {
	test('keys the pack on its own, since there is only ever the one', () => {
		expect(defaultPackQueryOptions().queryKey).toStrictEqual(['defaultPack']);
	});

	test('keys a rule by its id, so each rule is cached apart', () => {
		expect(defaultPackRuleQueryOptions({ rule: 'folder-size' }).queryKey).toStrictEqual(['defaultPackRule', 'folder-size']);
	});

	test('never goes stale, since the pack is bundled into the app and cannot change while it runs', () => {
		expect([defaultPackQueryOptions().staleTime, defaultPackRuleQueryOptions({ rule: 'folder-size' }).staleTime]).toStrictEqual([
			Number.POSITIVE_INFINITY,
			Number.POSITIVE_INFINITY,
		]);
	});
});
