import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, jest, test } from '@jest/globals';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig.ts';
import type { StandardsGroup } from '#src/standards/common/types/StandardsGroup.ts';
import { resolveStandardsGroups } from '#src/standards/resolveStandardsGroups.ts';
import { getRejectionError } from '#tests/helpers/getRejectionError.ts';

const baseConfig: LightsoutConfig = { gates: { check: 'true', test: 'true', 'test-coverage': false } };

/** Writes each repo-relative file under `root`, making the folders it sits under. */
const writeFiles = ({ root, files }: { root: string; files: Record<string, string> }) => {
	for (const [path, content] of Object.entries(files)) {
		const absolutePath = join(root, path);

		mkdirSync(dirname(absolutePath), { recursive: true });
		writeFileSync(absolutePath, content);
	}
};

/** One rule folder's files: its markdown plus the fixture pair every rule ships. */
const ruleFiles = ({ path, summary }: { path: string; summary: string }) => ({
	[`${path}/rule.md`]: `---\nsummary: ${summary}\n---\n\n${summary} — the rule's prose.\n`,
	[`${path}/fixtures/pass/src/example.ts`]: 'export const example = 1;\n',
	[`${path}/fixtures/fail/src/example.ts`]: 'export const example = 2;\n',
});

/**
 * A small built-in `lightsout` library holding the three pack addresses these
 * tests reach: `node` (one base topic, rule `tabs`), `react-app` (node plus one
 * react topic, rule `hooks-first`) and `tanstack-start-app` (react-app plus one
 * tanstack topic, rule `loaders`), so which pack a group got shows in its rules
 * as well as its name.
 */
const builtInLibraryFiles = {
	'lightsout-standards.json': '{ "name": "lightsout", "formatVersion": 2 }\n',
	'rules/code/base/topic.md': '# Base\n\nHow every package writes code.\n',
	...ruleFiles({ path: 'rules/code/base/01-tabs', summary: 'indent with tabs' }),
	'rules/code/react/topic.md': '# React\n\nHow components are written.\n',
	...ruleFiles({ path: 'rules/code/react/01-hooks-first', summary: 'hooks come before handlers' }),
	'rules/code/tanstack/topic.md': '# TanStack Start\n\nHow routes load data.\n',
	...ruleFiles({ path: 'rules/code/tanstack/01-loaders', summary: 'routes load data in loaders' }),
	'packs/node.json': JSON.stringify({ description: 'The node pack.', include: { topics: ['lightsout/code/base'] } }),
	'packs/react-app.json': JSON.stringify({
		description: 'The react-app pack.',
		include: { packs: ['lightsout/node'], topics: ['lightsout/code/react'] },
	}),
	'packs/tanstack-start-app.json': JSON.stringify({
		description: 'The tanstack-start-app pack.',
		include: { packs: ['lightsout/react-app'], topics: ['lightsout/code/tanstack'] },
	}),
};

/**
 * A temp repo whose root manifest declares no framework, holding one workspace
 * package under `packages/` per key of `workspacePackages`, each declaring the
 * dependencies its value lists, with LIGHTSOUT_DEFAULT_STANDARDS aimed at the
 * small built-in library. restoreMocks puts the real environment back after
 * each test.
 */
const setupRepo = ({ workspacePackages = { engine: {}, 'web-app': {} } }: { workspacePackages?: Record<string, Record<string, string>> } = {}) => {
	const cwd = mkdtempSync(join(tmpdir(), 'lightsout-package-packs-'));
	const libraryPath = mkdtempSync(join(tmpdir(), 'lightsout-package-packs-library-'));
	const packageManifests = Object.fromEntries(
		Object.entries(workspacePackages).map(([name, dependencies]) => [`packages/${name}/package.json`, JSON.stringify({ name, dependencies })]),
	);

	writeFiles({ root: libraryPath, files: builtInLibraryFiles });
	writeFiles({ root: cwd, files: { 'package.json': JSON.stringify({ name: 'repo', dependencies: {} }), ...packageManifests } });
	jest.replaceProperty(process, 'env', { ...process.env, LIGHTSOUT_DEFAULT_STANDARDS: libraryPath });

	return { cwd };
};

/**
 * A repo in which every library would fail to load: the built-in override
 * names a folder holding no library. The caller's `standards-libraries` entry
 * adds a folder that does not exist.
 */
const setupUnloadableRepo = () => {
	const cwd = mkdtempSync(join(tmpdir(), 'lightsout-package-packs-off-'));
	const notALibrary = join(cwd, 'not-a-library');

	mkdirSync(notALibrary, { recursive: true });
	jest.replaceProperty(process, 'env', { ...process.env, LIGHTSOUT_DEFAULT_STANDARDS: notALibrary });

	return { cwd };
};

/** What a group says about itself, without its rule-state map. */
const summarizeGroups = ({ groups }: { groups: StandardsGroup[] }) =>
	groups.map((group) => ({
		packages: group.packages,
		pack: group.pack.name,
		source: group.source,
		rules: group.pack.rules.map(({ rule }) => rule.name).sort(),
	}));

/** The repo pack is node for the root and engine; web-app is named onto react-app. */
const splitConfig: LightsoutConfig = {
	...baseConfig,
	'standards-pack': 'lightsout/node',
	'package-standards-packs': { 'web-app': 'lightsout/react-app' },
};

describe('resolveStandardsGroups', () => {
	test('gives a package named in package-standards-packs its own group and leaves unnamed packages with the repo pack', async () => {
		const { cwd } = setupRepo();

		const groups = await resolveStandardsGroups({ cwd, config: splitConfig });

		expect(summarizeGroups({ groups })).toStrictEqual([
			{ packages: ['', 'engine'], pack: 'lightsout/node', source: 'named', rules: ['lightsout/tabs'] },
			{ packages: ['web-app'], pack: 'lightsout/react-app', source: 'named', rules: ['lightsout/hooks-first', 'lightsout/tabs'] },
		]);
	});

	test("detects each unnamed package's pack from its own package.json and joins packages that detect the same pack", async () => {
		const { cwd } = setupRepo({ workspacePackages: { engine: {}, 'web-app': { '@tanstack/react-start': '^1.0.0' } } });

		const groups = await resolveStandardsGroups({ cwd, config: baseConfig });

		// the root manifest declares no framework, so tanstack-start-app can only come from web-app's own manifest
		expect(summarizeGroups({ groups })).toStrictEqual([
			{ packages: ['', 'engine'], pack: 'lightsout/node', source: 'detected', rules: ['lightsout/tabs'] },
			{
				packages: ['web-app'],
				pack: 'lightsout/tanstack-start-app',
				source: 'detected',
				rules: ['lightsout/hooks-first', 'lightsout/loaders', 'lightsout/tabs'],
			},
		]);
	});

	test('with standards-pack false, returns groups only for packages package-standards-packs names', async () => {
		const { cwd } = setupRepo();
		const config: LightsoutConfig = { ...baseConfig, 'standards-pack': false, 'package-standards-packs': { 'web-app': 'lightsout/react-app' } };

		const groups = await resolveStandardsGroups({ cwd, config });

		expect(summarizeGroups({ groups })).toStrictEqual([
			{ packages: ['web-app'], pack: 'lightsout/react-app', source: 'named', rules: ['lightsout/hooks-first', 'lightsout/tabs'] },
		]);
	});

	test('with standards-pack false and no package-standards-packs, returns no group before reading any library', async () => {
		const { cwd } = setupUnloadableRepo();
		const config: LightsoutConfig = { ...baseConfig, 'standards-pack': false, 'standards-libraries': { broken: './missing' } };

		const groups = await resolveStandardsGroups({ cwd, config });

		// both the built-in override and the registered entry would throw if read, so resolving at all proves neither was
		expect(groups).toStrictEqual([]);
	});

	test('refuses a package-standards-packs key that names no workspace package, listing the packages that exist', async () => {
		const { cwd } = setupRepo();
		const config: LightsoutConfig = { ...baseConfig, 'package-standards-packs': { 'web-ap': 'lightsout/node' } };

		const error = await getRejectionError({ promise: resolveStandardsGroups({ cwd, config }) });

		// web-ap is a prefix of web-app, so the key is only named when it is not followed by the missing p
		expect(error.message).toEqual(expect.stringMatching(/web-ap(?!p)/));
		expect(error.message).toContain('engine');
		expect(error.message).toContain('web-app');
	});

	test('refuses a package-standards-packs key in a repo with no workspace package, saying none exist', async () => {
		const { cwd } = setupRepo({ workspacePackages: {} });
		const config: LightsoutConfig = { ...baseConfig, 'package-standards-packs': { 'web-app': 'lightsout/react-app' } };

		const error = await getRejectionError({ promise: resolveStandardsGroups({ cwd, config }) });

		expect(error.message).toEqual(expect.stringMatching(/"web-app".*none/));
	});

	test('applies a standards-rule-settings entry only to the groups whose pack holds the rule', async () => {
		const { cwd } = setupRepo();
		const config: LightsoutConfig = { ...splitConfig, 'standards-rule-settings': { 'hooks-first': 'advisory' } };

		const groups = await resolveStandardsGroups({ cwd, config });

		expect({
			webApp: groups.find((group) => group.packages.includes('web-app'))?.states.get('lightsout/hooks-first'),
			rootHoldsRule: groups.find((group) => group.packages.includes(''))?.states.has('lightsout/hooks-first'),
		}).toEqual({
			webApp: expect.objectContaining({ severity: 'advisory', fromConfig: true }),
			rootHoldsRule: false,
		});
	});

	test('resolves standards-rule-settings names against every pack the repo selects, so a scoped call accepts what an unscoped one accepts', async () => {
		const { cwd } = setupRepo();
		const config: LightsoutConfig = { ...splitConfig, 'standards-rule-settings': { 'hooks-first': 'advisory' } };
		const unknown: LightsoutConfig = { ...splitConfig, 'standards-rule-settings': { 'no-such-rule': 'advisory' } };

		const [scoped, error] = await Promise.all([
			resolveStandardsGroups({ cwd, config, packages: ['engine'] }),
			getRejectionError({ promise: resolveStandardsGroups({ cwd, config: unknown, packages: ['engine'] }) }),
		]);

		// hooks-first sits only in web-app's pack, which the engine scope never reaches, yet the name still resolves
		expect({ scoped: summarizeGroups({ groups: scoped }).map(({ packages, pack }) => ({ packages, pack })), error: error.message }).toEqual({
			scoped: [{ packages: ['', 'engine'], pack: 'lightsout/node' }],
			error: expect.stringContaining('no-such-rule'),
		});
	});

	test('covers only the scoped packages plus the repo root group when packages split', async () => {
		const { cwd } = setupRepo();

		const groups = await resolveStandardsGroups({ cwd, config: splitConfig, packages: ['web-app'] });

		expect(summarizeGroups({ groups }).map(({ packages, pack }) => ({ packages, pack }))).toStrictEqual([
			{ packages: [''], pack: 'lightsout/node' },
			{ packages: ['web-app'], pack: 'lightsout/react-app' },
		]);
	});

	test('treats a scope name that is not a workspace package as root files covered by the root group', async () => {
		const { cwd } = setupRepo();

		const groups = await resolveStandardsGroups({ cwd, config: splitConfig, packages: ['web-app', 'scripts'] });

		expect(summarizeGroups({ groups }).map(({ packages, pack }) => ({ packages, pack }))).toStrictEqual([
			{ packages: [''], pack: 'lightsout/node' },
			{ packages: ['web-app'], pack: 'lightsout/react-app' },
		]);
	});

	test('keeps a named and a detected use of the same pack in separate groups so each reports its own source', async () => {
		const { cwd } = setupRepo({ workspacePackages: { engine: {} } });
		const config: LightsoutConfig = { ...baseConfig, 'package-standards-packs': { engine: 'lightsout/node' } };

		const groups = await resolveStandardsGroups({ cwd, config });

		expect(summarizeGroups({ groups })).toStrictEqual([
			{ packages: [''], pack: 'lightsout/node', source: 'detected', rules: ['lightsout/tabs'] },
			{ packages: ['engine'], pack: 'lightsout/node', source: 'named', rules: ['lightsout/tabs'] },
		]);
	});
});
