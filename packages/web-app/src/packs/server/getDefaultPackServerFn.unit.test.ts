import { describe, expect, test } from '@jest/globals';
import { getDefaultPackBundle } from '#src/packs/server/common/getDefaultPackBundle.ts';
import { getDefaultPackServerFn } from '#src/packs/server/getDefaultPackServerFn.ts';

describe('getDefaultPackServerFn', () => {
	test('answers with the pack lightsout ships, whatever repo the site runs in', async () => {
		const pack = await getDefaultPackServerFn();

		expect({ name: pack.name, rules: pack.rules.length }).toStrictEqual({ name: getDefaultPackBundle().name, rules: getDefaultPackBundle().rules.length });
	});

	test('leaves the prose and the fixture text behind, since the pages it serves list rules rather than argue them', async () => {
		const pack = await getDefaultPackServerFn();

		expect(pack.rules.some((rule) => 'prose' in rule || 'fixtures' in rule)).toBe(false);
	});
});
