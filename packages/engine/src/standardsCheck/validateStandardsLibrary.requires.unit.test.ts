import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from '@jest/globals';
import type { LoadedStandardsLibrary } from '#src/common/types/LoadedStandardsLibrary.ts';
import type { LoadedStandardsPackFile } from '#src/common/types/LoadedStandardsPackFile.ts';
import type { LoadedStandardsRule } from '#src/common/types/LoadedStandardsRule.ts';
import { StandardsSeverity } from '#src/contracts/standardsCheck/StandardsSeverity.ts';
import { validateStandardsLibrary } from '#src/standardsCheck/validateStandardsLibrary.ts';

/** A full fixture pair on disk, so the per-rule pass reports no problem and every problem left is a requires problem. */
const writeFixturePair = () => {
	const fixturesPath = join(mkdtempSync(join(tmpdir(), 'lightsout-validate-requires-')), 'fixtures');

	for (const side of ['pass', 'fail']) {
		mkdirSync(join(fixturesPath, side, 'src'), { recursive: true });
		writeFileSync(join(fixturesPath, side, 'src', 'example.ts'), 'export const value = 1;\n');
	}

	return fixturesPath;
};

/** A agent-only house rule; `requires` holds full names, as loading leaves them. */
const houseRule = ({ id, requires = [] }: { id: string; requires?: string[] }): LoadedStandardsRule => ({
	id,
	name: `house/${id}`,
	library: 'house',
	set: 'code',
	documentPath: 'code/demo',
	summary: 'a rule',
	prose: 'the argument for the rule',
	deterministic: false,
	agent: true,
	defaultSeverity: StandardsSeverity.Advisory,
	defaultOptions: {},
	fixturesPath: writeFixturePair(),
	requires,
});

const packFile = ({ name, rules, appliesWhen }: { name: string; rules: string[]; appliesWhen?: { dependencies: string[] } }): LoadedStandardsPackFile => ({
	name,
	filePath: `packs/${name}.json`,
	description: `the ${name} pack`,
	include: { packs: [], topics: [], rules },
	ruleSettings: {},
	appliesWhen,
});

const houseLibrary = ({ rules, packs = [] }: { rules: LoadedStandardsRule[]; packs?: LoadedStandardsPackFile[] }): LoadedStandardsLibrary => ({
	name: 'house',
	formatVersion: 2,
	rootPath: '/packages/house',
	documents: [],
	rules,
	packs,
});

/** house/a requires house/b; pack `keeps` holds both, pack `drops` holds only a. */
const setupPackDroppingARequirement = () => {
	const house = houseLibrary({
		rules: [houseRule({ id: 'a', requires: ['house/b'] }), houseRule({ id: 'b' })],
		packs: [packFile({ name: 'keeps', rules: ['a', 'b'] }), packFile({ name: 'drops', rules: ['a'] })],
	});

	return { house };
};

/** house/a requires house/b; the one pack, `drops`, holds only a and applies only to a package declaring react. */
const setupConditionalPackDroppingARequirement = () => {
	const house = houseLibrary({
		rules: [houseRule({ id: 'a', requires: ['house/b'] }), houseRule({ id: 'b' })],
		packs: [packFile({ name: 'drops', rules: ['a'], appliesWhen: { dependencies: ['react'] } })],
	});

	return { house };
};

/** The same house library and packs, marked built: its fixtures were left behind when it was built. */
const setupBuiltPackDroppingARequirement = () => {
	const { house } = setupPackDroppingARequirement();

	return { house: { ...house, built: true as const } };
};

/** house/a requires house/b; pack `broken` holds a without b and also names rule `nope`, which house does not declare. */
const setupUnresolvablePackDroppingARequirement = () => {
	const house = houseLibrary({
		rules: [houseRule({ id: 'a', requires: ['house/b'] }), houseRule({ id: 'b' })],
		packs: [packFile({ name: 'broken', rules: ['a', 'nope'] })],
	});

	return { house };
};

/** house/a requires a rule in acme, which nothing registers. */
const setupUnregisteredRequirement = () => {
	const house = houseLibrary({ rules: [houseRule({ id: 'a', requires: ['acme/x'] })] });

	return { house };
};

describe('validateStandardsLibrary', () => {
	test('warns once per missing requirement per pack and never as a problem', async () => {
		const { house } = setupPackDroppingARequirement();

		const { problems, warnings } = await validateStandardsLibrary({ library: house, libraries: [house] });

		// wording belongs to the author; what must survive is which pack, which rule and which requirement
		expect({
			problems,
			warnings: warnings.map((warning) => ({
				namesDrops: warning.includes('drops'),
				namesKeeps: warning.includes('keeps'),
				namesRule: warning.includes('house/a'),
				namesRequired: warning.includes('house/b'),
			})),
		}).toStrictEqual({ problems: [], warnings: [{ namesDrops: true, namesKeeps: false, namesRule: true, namesRequired: true }] });
	});

	test('judges a conditional pack whole, so its missing requirement is warned with no package to apply it to', async () => {
		const { house } = setupConditionalPackDroppingARequirement();

		const { problems, warnings } = await validateStandardsLibrary({ library: house, libraries: [house] });

		// a pack emptied by its condition would hold no rule and so warn of nothing
		expect({
			problems,
			warnings: warnings.map((warning) => ({
				namesDrops: warning.includes('drops'),
				namesRule: warning.includes('house/a'),
				namesRequired: warning.includes('house/b'),
			})),
		}).toStrictEqual({ problems: [], warnings: [{ namesDrops: true, namesRule: true, namesRequired: true }] });
	});

	test('gives a pack file that fails to resolve its problem and no requirement warnings', async () => {
		const { house } = setupUnresolvablePackDroppingARequirement();

		const { problems, warnings } = await validateStandardsLibrary({ library: house, libraries: [house] });

		expect({ problems: problems.map((problem) => problem.includes('nope')), warnings }).toStrictEqual({ problems: [true], warnings: [] });
	});

	test('gives a built library no requirement warnings, only the one built-pack problem', async () => {
		const { house } = setupBuiltPackDroppingARequirement();

		const { problems, warnings } = await validateStandardsLibrary({ library: house, libraries: [house] });

		expect({ problemCount: problems.length, namesBuilt: problems[0]?.includes('built pack'), warnings }).toStrictEqual({
			problemCount: 1,
			namesBuilt: true,
			warnings: [],
		});
	});

	test('reports an unresolvable cross-library requires entry as a problem', async () => {
		const { house } = setupUnregisteredRequirement();

		const { problems } = await validateStandardsLibrary({ library: house, libraries: [house] });

		// house has a fixture pair and no packs, so the requires entry is the only problem
		expect(problems.map((problem) => ({ namesRule: problem.includes('house/a'), namesEntry: problem.includes('acme/x') }))).toStrictEqual([
			{ namesRule: true, namesEntry: true },
		]);
	});
});
