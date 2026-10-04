import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from '@jest/globals';
import { type StandardsCheckFunction, StandardsInputKind } from '@lightsout/standards-contracts';
import type { LoadedStandardsLibrary } from '#src/common/types/LoadedStandardsLibrary.ts';
import type { LoadedStandardsPackFile } from '#src/common/types/LoadedStandardsPackFile.ts';
import type { LoadedStandardsRule } from '#src/common/types/LoadedStandardsRule.ts';
import { StandardsSeverity } from '#src/contracts/standardsCheck/StandardsSeverity.ts';
import { validateStandardsLibrary } from '#src/standardsCheck/validateStandardsLibrary/validateStandardsLibrary.ts';

/** A check that objects to any file named `banned.ts` — its fail fixture below holds none, so the rule reports a problem of its own. */
const bansTheBannedFile: StandardsCheckFunction = ({ inputs }) =>
	(inputs[StandardsInputKind.FileList]?.files ?? [])
		.filter((file) => file.endsWith('banned.ts'))
		.map((path) => ({
			siteKey: `blind-rule:${path}`,
			files: [{ path }],
			detail: 'a file the rule bans',
		}));

/** A fixture pair whose fail side holds nothing the check flags — proof the per-rule pass ran beside the pack pass. */
const setupBlindFixtures = () => {
	const fixturesPath = join(mkdtempSync(join(tmpdir(), 'lightsout-validate-packs-')), 'fixtures');

	for (const side of ['pass', 'fail']) {
		mkdirSync(join(fixturesPath, side, 'src'), { recursive: true });
		writeFileSync(join(fixturesPath, side, 'src', 'allowed.ts'), 'export const value = 1;\n');
	}

	return { fixturesPath };
};

const packFile = ({ name, packs = [], topics = [] }: { name: string; packs?: string[]; topics?: string[] }): LoadedStandardsPackFile => ({
	name,
	filePath: `packs/${name}.json`,
	description: `the ${name} pack`,
	include: { packs, topics, rules: [] },
	ruleSettings: {},
	appliesWhen: undefined,
});

const library = ({ name, packs, rules = [] }: { name: string; packs: LoadedStandardsPackFile[]; rules?: LoadedStandardsRule[] }): LoadedStandardsLibrary => ({
	name,
	formatVersion: 2,
	rootPath: `/packages/${name}`,
	documents: [],
	rules,
	packs,
});

/** acme with one rule whose check is blind, one pack naming a topic acme lacks, and two packs that include each other. */
const setupBrokenPacks = () => {
	const { fixturesPath } = setupBlindFixtures();
	const rule: LoadedStandardsRule = {
		id: 'blind-rule',
		name: 'acme/blind-rule',
		library: 'acme',
		set: 'code',
		documentPath: 'code/style-guide/structure/module-api',
		summary: 'a rule',
		prose: 'the argument for the rule',
		deterministic: true,
		agent: false,
		defaultSeverity: StandardsSeverity.Advisory,
		defaultOptions: {},
		requires: [],
		inputKinds: [StandardsInputKind.FileList],
		run: bansTheBannedFile,
		fixturesPath,
	};
	const acme = library({
		name: 'acme',
		rules: [rule],
		packs: [
			packFile({ name: 'broken', topics: ['acme/code/missing-topic'] }),
			packFile({ name: 'loop-one', packs: ['acme/loop-two'] }),
			packFile({ name: 'loop-two', packs: ['acme/loop-one'] }),
		],
	});

	return { acme };
};

/** house's one pack includes a pack from the built-in library and one from acme; acme is registered only when asked. */
const setupCrossLibraryPack = ({ acmeRegistered }: { acmeRegistered: boolean }) => {
	const builtIn = library({ name: 'lightsout', packs: [packFile({ name: 'standards' })] });
	const acme = library({ name: 'acme', packs: [packFile({ name: 'extras' })] });
	const house = library({ name: 'house', packs: [packFile({ name: 'combined', packs: ['lightsout/standards', 'acme/extras'] })] });
	const libraries = acmeRegistered ? [builtIn, acme, house] : [builtIn, house];

	return { house, libraries };
};

describe('validateStandardsLibrary', () => {
	test('validateStandardsLibrary reports unresolvable pack entries and include cycles beside the rule problems', async () => {
		const { acme } = setupBrokenPacks();

		const { problems } = await validateStandardsLibrary({ library: acme, libraries: [acme] });

		// wording belongs to the author; what must survive is which pack, which entry, and the whole cycle
		expect({
			ruleProblemStillReported: problems.includes('blind-rule: the fail fixture produced no finding — the check does not catch what the rule describes'),
			missingTopicNamesItsPack: problems.filter((problem) => problem.includes('acme/code/missing-topic')).map((problem) => problem.includes('acme/broken')),
			cycleNamed: problems.some((problem) => problem.includes('acme/loop-one') && problem.includes('acme/loop-two')),
		}).toStrictEqual({ ruleProblemStillReported: true, missingTopicNamesItsPack: [true], cycleNamed: true });
	});

	test.each([
		{ acmeRegistered: true, expected: [] },
		{ acmeRegistered: false, expected: [{ namesAcme: true, namesPack: true }] },
	])('validateStandardsLibrary resolves packs against the libraries it is given', async ({ acmeRegistered, expected }) => {
		const { house, libraries } = setupCrossLibraryPack({ acmeRegistered });

		const { problems } = await validateStandardsLibrary({ library: house, libraries });

		// house ships no rules, so every problem here is a pack problem
		expect(problems.map((problem) => ({ namesAcme: problem.includes('acme'), namesPack: problem.includes('house/combined') }))).toStrictEqual(expected);
	});
});
