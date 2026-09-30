import { describe, expect, test } from '@jest/globals';
import { StandardsSeverity } from '#src/contracts/standardsCheck/StandardsSeverity.ts';
import type { LoadedStandardsLibrary } from '#src/standardsLibraries/common/types/LoadedStandardsLibrary.ts';
import type { LoadedStandardsRule } from '#src/standardsLibraries/common/types/LoadedStandardsRule.ts';
import { findUnresolvedRequirements } from '#src/standardsLibraries/findUnresolvedRequirements.ts';

/** A loaded rule `<library>/<id>` requiring `requires`, with every other field at a neutral value. */
const rule = ({ library, id, requires = [] }: { library: string; id: string; requires?: string[] }): LoadedStandardsRule => ({
	id,
	name: `${library}/${id}`,
	library,
	set: 'code',
	documentPath: 'code/demo',
	summary: 'a rule',
	prose: 'the argument for the rule',
	checked: false,
	defaultSeverity: StandardsSeverity.Advisory,
	defaultOptions: {},
	requires,
	fixturesPath: `/packages/${library}/${id}/fixtures`,
});

/** A loaded library named `name` holding `rules`, with no topics and no packs. */
const library = ({ name, rules }: { name: string; rules: LoadedStandardsRule[] }): LoadedStandardsLibrary => ({
	name,
	formatVersion: 2,
	rootPath: `/packages/${name}`,
	documents: [],
	rules,
	packs: [],
});

/**
 * Libraries `lightsout` and `house`. Each `house` rule requires one full name:
 * a real lightsout rule, a rule in the unregistered library `acme`, and a
 * lightsout rule that does not exist.
 */
const setupLibraries = () => {
	const lightsout = library({ name: 'lightsout', rules: [rule({ library: 'lightsout', id: 'size' })] });
	const house = library({
		name: 'house',
		rules: [
			rule({ library: 'house', id: 'uses-real', requires: ['lightsout/size'] }),
			rule({ library: 'house', id: 'uses-acme', requires: ['acme/size'] }),
			rule({ library: 'house', id: 'uses-missing', requires: ['lightsout/nope'] }),
		],
	});

	return { libraries: [lightsout, house] };
};

/**
 * Library `house` alone, whose entries are short ids: `a` requires its sibling
 * `b`, and `c` requires `ghost`, which no house rule is.
 */
const setupShortEntries = () => {
	const house = library({
		name: 'house',
		rules: [
			rule({ library: 'house', id: 'a', requires: ['b'] }),
			rule({ library: 'house', id: 'b' }),
			rule({ library: 'house', id: 'c', requires: ['ghost'] }),
		],
	});

	return { libraries: [house] };
};

describe('findUnresolvedRequirements', () => {
	test('returns a line per entry whose library is unregistered or whose rule does not exist', () => {
		const { libraries } = setupLibraries();

		const lines = findUnresolvedRequirements({ libraries });

		expect(lines).toHaveLength(2);
		expect(lines).toEqual(
			expect.arrayContaining([
				expect.stringMatching(/^(?=[\s\S]*house\/uses-acme)(?=[\s\S]*acme\/size)(?=[\s\S]*\bacme\b)/),
				expect.stringMatching(/^(?=[\s\S]*house\/uses-missing)(?=[\s\S]*lightsout\/nope)/),
			]),
		);
	});

	test("checks a short entry against the requiring rule's own library", () => {
		const { libraries } = setupShortEntries();

		const lines = findUnresolvedRequirements({ libraries });

		// b resolves among house's rules; ghost matches none of them, and house is registered
		expect(lines).toEqual([expect.stringMatching(/^(?=[\s\S]*house\/c)(?=[\s\S]*ghost)(?![\s\S]*does not register)/)]);
	});
});
