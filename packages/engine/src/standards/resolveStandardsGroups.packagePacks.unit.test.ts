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
 * react topic, rule `hooks-first`) and `react` (the react topic alone, applying
 * only to a package that declares react), so which pack a group got shows in
 * its rules as well as its name.
 */
const builtInLibraryFiles = {
	'lightsout-standards.json': '{ "name": "lightsout", "formatVersion": 2 }\n',
	'rules/code/base/topic.md': '# Base\n\nHow every package writes code.\n',
	...ruleFiles({ path: 'rules/code/base/01-tabs', summary: 'indent with tabs' }),
	'rules/code/react/topic.md': '# React\n\nHow components are written.\n',
	...ruleFiles({ path: 'rules/code/react/01-hooks-first', summary: 'hooks come before handlers' }),
	'packs/node.json': JSON.stringify({ description: 'The node pack.', include: { topics: ['lightsout/code/base'] } }),
	'packs/react-app.json': JSON.stringify({
		description: 'The react-app pack.',
		include: { packs: ['lightsout/node'], topics: ['lightsout/code/react'] },
	}),
	'packs/react.json': JSON.stringify({
		description: 'The react pack.',
		include: { topics: ['lightsout/code/react'] },
		'applies-when': { dependencies: ['react'] },
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
		conditionalPacks: group.pack.conditionalPacks,
		rules: group.pack.rules.map(({ rule }) => rule.name).sort(),
	}));

/** The packs every test's package entry or repo pack lists when it wants the conditional react pack beside node. */
const nodeWithReact = ['lightsout/node', 'lightsout/react'];

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
			{ packages: ['', 'engine'], pack: 'lightsout/node', conditionalPacks: [], rules: ['lightsout/tabs'] },
			{ packages: ['web-app'], pack: 'lightsout/react-app', conditionalPacks: [], rules: ['lightsout/hooks-first', 'lightsout/tabs'] },
		]);
	});

	test('splits packages naming the same packs into two groups when a conditional pack applies to only one of them', async () => {
		const { cwd } = setupRepo({ workspacePackages: { engine: {}, 'web-app': { react: '^19.0.0' } } });
		const config: LightsoutConfig = { ...baseConfig, 'standards-pack': nodeWithReact };

		const groups = await resolveStandardsGroups({ cwd, config });

		// the root manifest declares no react, so lightsout/react can only have applied from web-app's own manifest
		expect(summarizeGroups({ groups })).toStrictEqual([
			{ packages: ['', 'engine'], pack: 'lightsout/node + lightsout/react', conditionalPacks: [], rules: ['lightsout/tabs'] },
			{
				packages: ['web-app'],
				pack: 'lightsout/node + lightsout/react',
				conditionalPacks: ['lightsout/react'],
				rules: ['lightsout/hooks-first', 'lightsout/tabs'],
			},
		]);
	});

	test('accepts a standards-rule-settings entry for a rule only a conditional pack that applied to no package holds', async () => {
		const { cwd } = setupRepo();
		const config: LightsoutConfig = { ...baseConfig, 'standards-pack': nodeWithReact, 'standards-rule-settings': { 'hooks-first': 'advisory' } };

		const groups = await resolveStandardsGroups({ cwd, config });

		// no package declares react, so hooks-first runs nowhere and the setting changes no state
		expect(groups.map((group) => [...group.states.keys()])).toStrictEqual([['lightsout/tabs']]);
	});

	test.each<{ repoPack: string; config: LightsoutConfig }>([
		{ repoPack: 'false', config: { ...baseConfig, 'standards-pack': false } },
		{ repoPack: 'unset', config: baseConfig },
	])('with standards-pack $repoPack, returns groups only for packages package-standards-packs names', async ({ config }) => {
		const { cwd } = setupRepo();
		const packageConfig: LightsoutConfig = { ...config, 'package-standards-packs': { 'web-app': 'lightsout/react-app' } };

		const groups = await resolveStandardsGroups({ cwd, config: packageConfig });

		expect(summarizeGroups({ groups })).toStrictEqual([
			{ packages: ['web-app'], pack: 'lightsout/react-app', conditionalPacks: [], rules: ['lightsout/hooks-first', 'lightsout/tabs'] },
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

	test("puts a package named onto the repo's own pack in the root's group", async () => {
		const { cwd } = setupRepo({ workspacePackages: { engine: {} } });
		const config: LightsoutConfig = { ...baseConfig, 'standards-pack': 'lightsout/node', 'package-standards-packs': { engine: 'lightsout/node' } };

		const groups = await resolveStandardsGroups({ cwd, config });

		expect(summarizeGroups({ groups })).toStrictEqual([{ packages: ['', 'engine'], pack: 'lightsout/node', conditionalPacks: [], rules: ['lightsout/tabs'] }]);
	});

	test('orders groups that leave the root out by pack name, then by the conditional packs that applied', async () => {
		const { cwd } = setupRepo({ workspacePackages: { 'a-web': { react: '^19.0.0' }, 'b-api': {}, 'c-lib': {} } });
		const config: LightsoutConfig = {
			...baseConfig,
			'package-standards-packs': { 'a-web': nodeWithReact, 'b-api': nodeWithReact, 'c-lib': 'lightsout/node' },
		};

		const groups = await resolveStandardsGroups({ cwd, config });

		// the packages resolve in the order a-web, b-api, c-lib, so only the sort can put c-lib first and a-web last
		expect(summarizeGroups({ groups }).map(({ packages, pack, conditionalPacks }) => ({ packages, pack, conditionalPacks }))).toStrictEqual([
			{ packages: ['c-lib'], pack: 'lightsout/node', conditionalPacks: [] },
			{ packages: ['b-api'], pack: 'lightsout/node + lightsout/react', conditionalPacks: [] },
			{ packages: ['a-web'], pack: 'lightsout/node + lightsout/react', conditionalPacks: ['lightsout/react'] },
		]);
	});
});
