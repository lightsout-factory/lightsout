import { describe, expect, test } from '@jest/globals';
import committedBundle from '#assets/default-pack.json';
import { getDefaultPackBundle } from '#src/lightsout/common/utils/getDefaultPackBundle.ts';

// The committed bundle is the subject: parsing it against `StandardsPackBundle`
// is what catches `assets/default-pack.json` gone stale after a contract change.

describe('getDefaultPackBundle', () => {
	test('parses the committed pack against the contract the engine reads it to', () => {
		const bundle = getDefaultPackBundle();

		expect(bundle.name).toBe('lightsout');
	});

	test('the committed bundle carries the built-in library name lightsout', () => {
		const bundle = getDefaultPackBundle();

		expect(bundle.name).toBe('lightsout');
	});

	test('is the authored pack rather than the shipped copy, which is the whole reason the app carries it', () => {
		const bundle = getDefaultPackBundle();

		expect(bundle.built).toBe(false);
	});

	test('still has the fixtures a rule page exists to show', () => {
		const bundle = getDefaultPackBundle();

		expect(bundle.rules.some((rule) => rule.fixtures.length > 0)).toBe(true);
	});

	test('carries no machine’s path, since the file is committed and compared byte for byte', () => {
		const bundle = getDefaultPackBundle();

		expect(bundle.rootPath).toBe('packages/lightsout-standards');
	});

	test('parses the committed library bundle with its ten packs and a repo-relative root', () => {
		const bundle = getDefaultPackBundle();

		expect({
			name: bundle.name,
			rootPath: bundle.rootPath,
			packAddresses: bundle.packs.map((pack) => pack.address),
			carriesPath: Object.hasOwn(committedBundle, 'path'),
			carriesIsDefault: Object.hasOwn(committedBundle, 'isDefault'),
		}).toStrictEqual({
			name: 'lightsout',
			rootPath: 'packages/lightsout-standards',
			packAddresses: [
				'lightsout/nestjs',
				'lightsout/nestjs-app',
				'lightsout/node',
				'lightsout/react',
				'lightsout/react-app',
				'lightsout/structure',
				'lightsout/tanstack-start',
				'lightsout/tanstack-start-app',
				'lightsout/typescript',
				'lightsout/unit-testing',
			],
			carriesPath: false,
			carriesIsDefault: false,
		});
	});

	test('parses once and hands the same object back', () => {
		expect(getDefaultPackBundle()).toBe(getDefaultPackBundle());
	});
});
