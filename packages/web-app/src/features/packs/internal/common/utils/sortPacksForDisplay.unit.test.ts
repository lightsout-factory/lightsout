import { describe, expect, test } from '@jest/globals';
import { sortPacksForDisplay } from '#src/features/packs/internal/common/utils/sortPacksForDisplay.ts';
import { buildStandardsPackListing } from '#tests/helpers/buildStandardsPackListing.ts';

const setupPacks = ({ names }: { names: string[] }) => ({ packs: names.map((name) => buildStandardsPackListing({ name })) });

describe('sortPacksForDisplay', () => {
	test('lists the general packs first, then one pack per framework', () => {
		const { packs } = setupPacks({ names: ['code-style', 'fractal', 'react', 'standards', 'tanstack-start'] });

		const sorted = sortPacksForDisplay({ packs });

		expect(sorted.map((pack) => pack.address)).toStrictEqual([
			'lightsout/fractal',
			'lightsout/code-style',
			'lightsout/standards',
			'lightsout/react',
			'lightsout/tanstack-start',
		]);
	});

	test('keeps a pack it does not know after the built-in ones, in the order it arrived', () => {
		const { packs } = setupPacks({ names: ['zebra', 'react', 'alpha', 'fractal'] });

		const sorted = sortPacksForDisplay({ packs });

		expect(sorted.map((pack) => pack.address)).toStrictEqual(['lightsout/fractal', 'lightsout/react', 'lightsout/zebra', 'lightsout/alpha']);
	});
});
