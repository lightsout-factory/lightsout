import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from '@jest/globals';
import { type StandardsCheckFunction, StandardsInputKind } from '@lightsout/standards-contracts';
import { StandardsSeverity } from '#src/contracts/standardsCheck/StandardsSeverity.ts';
import { validateStandardsLibrary } from '#src/standardsCheck/validateStandardsLibrary.ts';
import type { LoadedStandardsLibrary } from '#src/standardsLibraries/common/types/LoadedStandardsLibrary.ts';
import type { LoadedStandardsRule } from '#src/standardsLibraries/common/types/LoadedStandardsRule.ts';
import { duplicatedSources, sharedImportSources, writeSampleSources } from '#tests/helpers/duplicationSamples.ts';

/** A ban on any file named `banned.ts`, asked of the files the engine could type rather than of the path list. */
const bansTheBannedTypedFile: StandardsCheckFunction = ({ inputs }) =>
	[...(inputs[StandardsInputKind.TypeChecker]?.typedFiles.keys() ?? [])]
		.filter((path) => path.endsWith('banned.ts'))
		.map((path) => ({
			siteKey: `named-string-values:${path}`,
			files: [{ path }],
			detail: 'a file the rule bans',
		}));

/** A ban asked of what a fixture side declares — the facts a framework carve-out is keyed on, which the graph itself cannot show. */
const bansTheDeclaredFramework: StandardsCheckFunction = ({ inputs }) =>
	(inputs[StandardsInputKind.ImportGraph]?.dependencies.get('.') ?? [])
		.filter((name) => name === '@nestjs/core')
		.map((name) => ({
			siteKey: `module-boundary:${name}`,
			files: [{ path: 'package.json' }],
			detail: 'a framework the rule bans',
		}));

/** Every duplicated span the engine's detector found — the duplication tier reads spans it never built itself. */
const reportsEveryDuplicateSpan: StandardsCheckFunction = ({ inputs }) =>
	(inputs[StandardsInputKind.CloneSpans]?.spans ?? []).map((span) => ({
		siteKey: `duplicate-code-block:${span.files.map((file) => file.path).join(':')}`,
		files: span.files,
		detail: 'the same block of code written out twice',
	}));

/**
 * A rule folder's fixture pair on disk. Each side is a miniature repo the check
 * runs against as if it were the whole thing.
 */
const setupFixtures = ({ pass, fail }: { pass: string[]; fail: string[] }) => {
	const fixturesPath = join(mkdtempSync(join(tmpdir(), 'lightsout-validate-')), 'fixtures');

	for (const [side, files] of [
		['pass', pass],
		['fail', fail],
	] as const) {
		mkdirSync(join(fixturesPath, side, 'src'), { recursive: true });

		for (const name of files) {
			writeFileSync(join(fixturesPath, side, 'src', name), 'export const value = 1;\n');
		}
	}

	return { fixturesPath };
};

/**
 * A fixture pair whose sides each carry a tsconfig of their own. A type-checker
 * rule needs one on the side it is run against: a fixture side is a miniature
 * repo, and a program has nothing to type its files with otherwise.
 */
const setupTypedFixtures = ({ pass, fail }: { pass: string[]; fail: string[] }) => {
	const { fixturesPath } = setupFixtures({ pass, fail });

	for (const side of ['pass', 'fail'] as const) {
		writeFileSync(join(fixturesPath, side, 'tsconfig.json'), '{ "compilerOptions": { "strict": true, "noEmit": true }, "include": ["src"] }\n');
	}

	return { fixturesPath };
};

/**
 * A fixture pair whose fail side declares a framework in a manifest of its own.
 * A side is a miniature repo, so the manifest sits at its root — the only place
 * a rule asking "does this package use a file-based router?" can read it.
 */
const setupDeclaringFixtures = ({ pass, fail }: { pass: string[]; fail: string[] }) => {
	const { fixturesPath } = setupFixtures({ pass, fail });

	writeFileSync(join(fixturesPath, 'pass', 'package.json'), '{ "name": "pass-side" }\n');
	writeFileSync(join(fixturesPath, 'fail', 'package.json'), '{ "name": "fail-side", "dependencies": { "@nestjs/core": "^10" } }\n');

	return { fixturesPath };
};

/**
 * A fixture pair for a duplication rule: the fail side writes one block out
 * twice, and the pass side shares only an import list — the boilerplate the
 * engine blanks before it detects anything, and the false positive the pass
 * side exists to prove.
 */
const setupDuplicatingFixtures = () => {
	const fixturesPath = join(mkdtempSync(join(tmpdir(), 'lightsout-validate-')), 'fixtures');

	writeSampleSources({ dir: join(fixturesPath, 'fail'), sources: duplicatedSources });
	writeSampleSources({ dir: join(fixturesPath, 'pass'), sources: sharedImportSources });

	return { fixturesPath };
};

/** What a pack shipping no framework-owned tree is told — every verdict below that sets none up carries it. */
const noFrameworkOwnedNote = 'acme: no fixtures/framework-owned/ — no rule was held to the framework-owned invariant';

const rule = (overrides: Partial<LoadedStandardsRule> & { id: string; fixturesPath: string }): LoadedStandardsRule => ({
	name: `acme/${overrides.id}`,
	library: 'acme',
	set: 'code',
	documentPath: 'code/style-guide/structure/module-api',
	summary: 'a rule',
	prose: 'the argument for the rule',
	checked: overrides.run !== undefined,
	reviewed: overrides.run === undefined,
	defaultSeverity: StandardsSeverity.Advisory,
	defaultOptions: {},
	requires: [],
	...overrides,
});

const validate = ({ rules, built }: { rules: LoadedStandardsRule[]; built?: true }) => {
	// No framework-owned tree anywhere in this file: the invariant's own verdicts
	// live in validateStandardsLibrary.frameworkOwned.unit.test.ts, and every test
	// here is about the per-rule pass it runs beside.
	const pack: LoadedStandardsLibrary = { name: 'acme', formatVersion: 2, built, rootPath: '/packages/acme', documents: [], rules, packs: [] };

	return validateStandardsLibrary({ library: pack, libraries: [pack] });
};

describe('validateStandardsLibrary input kinds', () => {
	test('validates a rule that needs parsed trees with the engine own typescript', async () => {
		const { fixturesPath } = setupFixtures({ pass: ['allowed.ts'], fail: ['banned.ts'] });
		const bansTheBannedTree: StandardsCheckFunction = ({ inputs }) =>
			[...(inputs[StandardsInputKind.SyntaxTree]?.trees.keys() ?? [])]
				.filter((path) => path.endsWith('banned.ts'))
				.map((path) => ({
					siteKey: `dead-export:${path}`,
					files: [{ path }],
					detail: 'a file the rule bans',
				}));

		const { problems, notes } = await validate({
			rules: [rule({ id: 'dead-export', fixturesPath, inputKinds: [StandardsInputKind.SyntaxTree], run: bansTheBannedTree })],
		});

		// the fixtures live in the engine's own repo, so the compiler is right there
		expect(problems).toStrictEqual([]);
		expect(notes).toStrictEqual([noFrameworkOwnedNote]);
	});

	test('validates a rule that needs a type checker against fixture sides that carry a tsconfig', async () => {
		const { fixturesPath } = setupTypedFixtures({ pass: ['allowed.ts'], fail: ['banned.ts'] });

		const { problems, notes } = await validate({
			rules: [rule({ id: 'named-string-values', fixturesPath, inputKinds: [StandardsInputKind.TypeChecker], run: bansTheBannedTypedFile })],
		});

		expect(problems).toStrictEqual([]);
		expect(notes).toStrictEqual([noFrameworkOwnedNote]);
	});

	test('a type-checker fixture side with no tsconfig is named as such, not reported as a check that catches nothing', async () => {
		const { fixturesPath } = setupFixtures({ pass: ['allowed.ts'], fail: ['banned.ts'] });

		const { problems } = await validate({
			rules: [rule({ id: 'named-string-values', fixturesPath, inputKinds: [StandardsInputKind.TypeChecker], run: bansTheBannedTypedFile })],
		});

		// a side the engine could type nothing in hands the check nothing, and the
		// silence that follows would otherwise send the author to the check
		expect(problems).toStrictEqual([
			"named-string-values: the fail fixture could not be checked — no tsconfig.json in fixtures/fail/, so none of its 1 file(s) could be typed — a type-checker rule's fixtures need one",
			"named-string-values: the pass fixture could not be checked — no tsconfig.json in fixtures/pass/, so none of its 1 file(s) could be typed — a type-checker rule's fixtures need one",
		]);
	});

	test('validates an import-graph rule against what its fixture side declares, not its edges alone', async () => {
		const { fixturesPath } = setupDeclaringFixtures({ pass: ['allowed.ts'], fail: ['banned.ts'] });

		const { problems, notes } = await validate({
			rules: [rule({ id: 'module-boundary', fixturesPath, inputKinds: [StandardsInputKind.ImportGraph], run: bansTheDeclaredFramework })],
		});

		// the two sides differ only in what their manifests declare, so a pass here
		// is the declarations reaching the check — and the fixtures live in the
		// engine's own repo, so the compiler the kind needs is right there
		expect(problems).toStrictEqual([]);
		expect(notes).toStrictEqual([noFrameworkOwnedNote]);
	});

	test('validates a duplicate-block rule against the spans the engine detected for it', async () => {
		const { fixturesPath } = setupDuplicatingFixtures();

		const { problems, notes } = await validate({
			rules: [
				rule({
					id: 'duplicate-code-block',
					fixturesPath,
					inputKinds: [StandardsInputKind.CloneSpans],
					run: reportsEveryDuplicateSpan,
					defaultOptions: { minTokens: 50 },
				}),
			],
		});

		// the kind parses nothing, so no compiler is resolved for it — and a pass
		// here is both halves of the pair: the fail side's duplicated block
		// reaching the check, and the pass side's shared import list never being
		// counted as one
		expect(problems).toStrictEqual([]);
		expect(notes).toStrictEqual([noFrameworkOwnedNote]);
	});
});
