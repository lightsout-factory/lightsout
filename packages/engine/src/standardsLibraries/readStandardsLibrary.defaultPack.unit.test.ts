import { readdir, readFile } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import { describe, expect, test } from '@jest/globals';
import { StandardsSet } from '@lightsout/standards-contracts';
import { StandardsSeverity } from '#src/contracts/standardsCheck/StandardsSeverity.ts';
import type { StandardsGroup } from '#src/standards/common/types/StandardsGroup.ts';
import type { ResolvedRuleState } from '#src/standardsCheck/common/types/ResolvedRuleState.ts';
import { buildStandardsDocuments } from '#src/standardsLibraries/buildStandardsDocuments.ts';
import type { LoadedStandardsLibrary } from '#src/standardsLibraries/common/types/LoadedStandardsLibrary.ts';
import { readStandardsLibrary } from '#src/standardsLibraries/readStandardsLibrary.ts';
import { resolveStandardsPack } from '#src/standardsLibraries/resolveStandardsPack.ts';

/**
 * The pack the plugin ships, loaded from disk exactly as a consumer's run
 * loads it. This is the only test that reads the real default pack, so it is
 * where the shipped tree's shape is pinned: how many documents it carries and
 * that every rule claiming a check ships one.
 */
const setupDefaultPack = async () => {
	// The authored pack, not its build copy under plugin/ — a test that read
	// the copy would pass or fail on whether someone had run `pnpm bundle`.
	//
	// Anchored on this file rather than on process.cwd(): the working directory
	// depends on where the runner was invoked from, which is exactly the sort of
	// thing that changes when a repo grows a second place to run tests from.
	const packPath = join(__dirname, '..', '..', '..', 'lightsout-standards');

	return { pack: await readStandardsLibrary({ packPath }) };
};

/**
 * The one group a repo whose manifest names no framework gets: the shipped
 * library's standards pack with none of its framework packs applied, every
 * rule at the pack's own grade.
 */
const frameworkFreeGroupOf = ({ pack }: { pack: LoadedStandardsLibrary }): StandardsGroup => {
	const resolved = resolveStandardsPack({ addresses: ['lightsout/standards'], libraries: [pack], dependencies: new Set() });

	return {
		packages: [''],
		pack: resolved,
		states: new Map<string, ResolvedRuleState>(
			resolved.rules.map(({ rule, severity, options }) => [
				rule.name,
				{ severity, options, fromConfig: false, reachesAgents: severity !== StandardsSeverity.Off },
			]),
		),
	};
};

/** Folders under the library that hold no authored check: installed packages, coverage output and test data. */
const skippedFolders = new Set(['node_modules', 'coverage', 'fixtures']);

/** Every `check.ts` under `folder`, wherever its topic tree sits. */
const listCheckFiles = async ({ folder }: { folder: string }): Promise<string[]> => {
	const entries = await readdir(folder, { withFileTypes: true });
	const nested = await Promise.all(
		entries.map(async (entry) => {
			const path = join(folder, entry.name);
			if (entry.isDirectory()) {
				return skippedFolders.has(entry.name) ? [] : listCheckFiles({ folder: path });
			}

			return entry.name === 'check.ts' ? [path] : [];
		}),
	);

	return nested.flat();
};

/**
 * The built-in library's manifest, each of its checks paired with the module
 * specifiers it imports, and the library loaded as a run loads it.
 */
const setupCheckImports = async () => {
	const { pack } = await setupDefaultPack();
	// the same authored folder setupDefaultPack loads, anchored on this file for the same reason
	const libraryPath = join(__dirname, '..', '..', '..', 'lightsout-standards');
	const manifest: { imports?: unknown } = JSON.parse(await readFile(join(libraryPath, 'package.json'), 'utf8'));
	const checkFiles = await listCheckFiles({ folder: libraryPath });
	const checks = await Promise.all(
		checkFiles.map(async (file) => {
			const text = await readFile(file, 'utf8');
			const specifiers = [...text.matchAll(/(?:\bfrom\s*|\bimport\s*\(\s*|^\s*import\s+)'([^']+)'/gm)].map((match) => match[1] ?? '');

			return { file, specifiers };
		}),
	);

	return { pack, manifest, checks, commonFolder: join(libraryPath, 'common') + sep };
};

/** The built-in library loaded as a run loads it, with the folder names at its root and under its rules/ folder. */
const setupLibraryLayout = async () => {
	const { pack } = await setupDefaultPack();
	// the same authored folder setupDefaultPack loads, anchored on this file for the same reason
	const libraryPath = join(__dirname, '..', '..', '..', 'lightsout-standards');
	const folderNames = async ({ folder }: { folder: string }): Promise<string[]> => {
		const entries = await readdir(folder, { withFileTypes: true });

		return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
	};
	const rootFolders = await folderNames({ folder: libraryPath });
	const rulesFolders = await folderNames({ folder: join(libraryPath, 'rules') });

	return { pack, rootFolders, rulesFolders };
};

describe('readStandardsLibrary', () => {
	test('carries all 13 shipped documents, split across the code and tests trees', async () => {
		const { pack } = await setupDefaultPack();

		expect(pack.name).toBe('lightsout');
		expect(pack.documents).toHaveLength(13);
		expect(pack.documents.filter((document) => document.set === StandardsSet.Code)).toHaveLength(9);
		expect(pack.documents.filter((document) => document.set === StandardsSet.Tests)).toHaveLength(4);
	});

	test('carries the line and the address the root file states about the pack itself', async () => {
		const { pack } = await setupDefaultPack();

		// what a pack page shows under the name — read from the root file rather
		// than from any folder, so this is the only place they can come from
		expect({ description: pack.description, homepage: pack.homepage }).toEqual({
			description: expect.stringContaining('TypeScript standards'),
			homepage: 'https://github.com/lightsout-factory/lightsout/tree/main/packages/lightsout-standards',
		});
	});

	test('every rule declaring a check ships one that can be run', async () => {
		const { pack } = await setupDefaultPack();

		const checked = pack.rules.filter((rule) => rule.deterministic);
		const runnable = checked.filter((rule) => typeof rule.run === 'function' && rule.inputKinds !== undefined);

		// the honesty rule at load time is what makes this hold — this pins that it holds for the shipped pack
		expect(checked.length).toBeGreaterThan(0);
		expect(runnable).toHaveLength(checked.length);
		// a agent-only rule declares no check and carries none
		expect(pack.rules.filter((rule) => !rule.deterministic).every((rule) => rule.run === undefined)).toBe(true);
	});

	test('assembles both sets for a repo running no framework, each document headed by where it came from', async () => {
		const { pack } = await setupDefaultPack();

		const { code, tests } = buildStandardsDocuments({ groups: [frameworkFreeGroupOf({ pack })] });

		expect(code?.match(/^<!-- lightsout: code\/.+ -->$/gm)).toHaveLength(8);
		expect(tests?.match(/^<!-- lightsout: tests\/.+ -->$/gm)).toHaveLength(2);
		// the prose itself rides along, not just the headers
		expect(code ?? '').toContain('File Placement');
		expect(tests ?? '').toContain('Module Boundary Testing');
	});

	test('the built-in library is named lightsout and every rule name starts with lightsout/', async () => {
		const { pack } = await setupDefaultPack();

		const misnamed = pack.rules.filter((rule) => rule.name !== `lightsout/${rule.id}`).map((rule) => rule.name);

		// an empty rule list would make "every rule" hold vacuously
		expect(pack.rules.length).toBeGreaterThan(0);
		expect({ name: pack.name, misnamed }).toStrictEqual({ name: 'lightsout', misnamed: [] });
	});

	test("every check that reaches the library's common folder imports it through #common, and every checked rule's check loads", async () => {
		const { pack, manifest, checks, commonFolder } = await setupCheckImports();

		const relativeIntoCommon = checks.flatMap(({ file, specifiers }) =>
			specifiers
				.filter((specifier) => specifier.startsWith('../'))
				.filter((specifier) => resolve(dirname(file), specifier).startsWith(commonFolder))
				.map((specifier) => `${file}: ${specifier}`),
		);
		const importsThroughAlias = checks.some(({ specifiers }) => specifiers.some((specifier) => specifier.startsWith('#common/')));
		const checked = pack.rules.filter((rule) => rule.deterministic);
		const unloadable = checked.filter((rule) => typeof rule.run !== 'function' || rule.inputKinds === undefined).map((rule) => rule.name);

		// an empty check list would make "every check" hold vacuously
		expect({ checkFiles: checks.length > 0, checkedRules: checked.length > 0 }).toStrictEqual({
			checkFiles: true,
			checkedRules: true,
		});
		expect({ imports: manifest.imports, relativeIntoCommon, importsThroughAlias, unloadable }).toStrictEqual({
			imports: { '#common/*': './common/*' },
			relativeIntoCommon: [],
			importsThroughAlias: true,
			unloadable: [],
		});
	});

	test('the built-in library keeps every topic under rules and loads the check of every checked rule', async () => {
		const { pack, rootFolders, rulesFolders } = await setupLibraryLayout();

		const checked = pack.rules.filter((rule) => rule.deterministic);
		const unloadable = checked.filter((rule) => typeof rule.run !== 'function' || rule.inputKinds === undefined).map((rule) => rule.name);

		// an empty checked-rule list would make "every checked rule" hold vacuously
		expect(checked.length).toBeGreaterThan(0);
		expect({
			formatVersion: pack.formatVersion,
			rootCode: rootFolders.includes('code'),
			rootTests: rootFolders.includes('tests'),
			rulesCode: rulesFolders.includes('code'),
			rulesTests: rulesFolders.includes('tests'),
			unloadable,
		}).toStrictEqual({
			formatVersion: 2,
			rootCode: false,
			rootTests: false,
			rulesCode: true,
			rulesTests: true,
			unloadable: [],
		});
	});
});
