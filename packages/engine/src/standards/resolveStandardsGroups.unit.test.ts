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
 * A small built-in `lightsout` library holding the two pack addresses these
 * tests reach: `node` (one base topic, rule `tabs`) and `react-app` (node plus
 * one react topic, rule `hooks-first`), so which pack a group got shows in its
 * rules as well as its name.
 */
const builtInLibraryFiles = {
	'lightsout-standards.json': '{ "name": "lightsout", "formatVersion": 1 }\n',
	'code/base/topic.md': '# Base\n\nHow every package writes code.\n',
	...ruleFiles({ path: 'code/base/01-tabs', summary: 'indent with tabs' }),
	'code/react/topic.md': '# React\n\nHow components are written.\n',
	...ruleFiles({ path: 'code/react/01-hooks-first', summary: 'hooks come before handlers' }),
	'packs/node.json': JSON.stringify({ description: 'The node pack.', include: { topics: ['lightsout/code/base'] } }),
	'packs/react-app.json': JSON.stringify({
		description: 'The react-app pack.',
		include: { packs: ['lightsout/node'], topics: ['lightsout/code/react'] },
	}),
};

/**
 * A temp repo whose root manifest declares `rootDependencies`, holding one
 * workspace package per name in `workspacePackages` under `packages/`, with
 * LIGHTSOUT_DEFAULT_STANDARDS aimed at the small built-in library. The
 * environment is replaced outright; restoreMocks puts the real one back after
 * each test.
 */
const setupRepo = ({ rootDependencies = {}, workspacePackages = [] }: { rootDependencies?: Record<string, string>; workspacePackages?: string[] } = {}) => {
	const cwd = mkdtempSync(join(tmpdir(), 'lightsout-resolve-groups-'));
	const libraryPath = mkdtempSync(join(tmpdir(), 'lightsout-groups-library-'));
	const packageManifests = Object.fromEntries(workspacePackages.map((name) => [`packages/${name}/package.json`, JSON.stringify({ name })]));

	writeFiles({ root: libraryPath, files: builtInLibraryFiles });
	writeFiles({ root: cwd, files: { 'package.json': JSON.stringify({ name: 'repo', dependencies: rootDependencies }), ...packageManifests } });
	jest.replaceProperty(process, 'env', { ...process.env, LIGHTSOUT_DEFAULT_STANDARDS: libraryPath });

	return { cwd };
};

/**
 * Two repos sharing the small built-in library: a workspace holding `engine`
 * and `web-app` under `packages/`, and a flat repo with no packages folder.
 */
const setupScopeRepos = () => {
	const { cwd: workspaceCwd } = setupRepo({ workspacePackages: ['engine', 'web-app'] });
	const flatCwd = mkdtempSync(join(tmpdir(), 'lightsout-resolve-groups-flat-'));

	writeFiles({ root: flatCwd, files: { 'package.json': JSON.stringify({ name: 'flat' }) } });

	return { workspaceCwd, flatCwd };
};

/**
 * Two repos sharing the small built-in library whose workspace packages sit in
 * different folders: one under the default `packages/`, one under `apps/`,
 * with a decoy `packages/` folder beside it that only a missed `packages-dir`
 * would read.
 */
const setupPackagesDirRepos = () => {
	const { cwd: defaultCwd } = setupRepo({ workspacePackages: ['engine'] });
	const appsCwd = mkdtempSync(join(tmpdir(), 'lightsout-resolve-groups-apps-'));

	writeFiles({
		root: appsCwd,
		files: {
			'package.json': JSON.stringify({ name: 'apps-repo' }),
			'apps/site/package.json': JSON.stringify({ name: 'site' }),
			'packages/decoy/package.json': JSON.stringify({ name: 'decoy' }),
		},
	});

	return { defaultCwd, appsCwd };
};

/**
 * A repo in which every library would fail to load: the built-in override
 * names a folder holding no library, and `standards-libraries` registers a
 * folder that does not exist.
 */
const setupUnloadableRepo = () => {
	const cwd = mkdtempSync(join(tmpdir(), 'lightsout-resolve-groups-off-'));
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

describe('resolveStandardsGroups', () => {
	test("resolveStandardsGroups: with no standards-pack the root manifest picks the root group's pack and each package's own manifest picks its pack", async () => {
		const { cwd } = setupRepo({ rootDependencies: { react: '^19.0.0' }, workspacePackages: ['web', 'api'] });

		const groups = await resolveStandardsGroups({ cwd, config: baseConfig });

		// the packages' manifests declare no framework, so the root's react never reaches them
		expect(summarizeGroups({ groups })).toStrictEqual([
			{ packages: [''], pack: 'lightsout/react-app', source: 'detected', rules: ['lightsout/hooks-first', 'lightsout/tabs'] },
			{ packages: ['api', 'web'], pack: 'lightsout/node', source: 'detected', rules: ['lightsout/tabs'] },
		]);
	});

	test('resolveStandardsGroups: a named pack wins over what detection would pick', async () => {
		const { cwd } = setupRepo({ rootDependencies: { react: '^19.0.0' } });
		const config: LightsoutConfig = { ...baseConfig, 'standards-pack': 'lightsout/node' };

		const groups = await resolveStandardsGroups({ cwd, config });

		expect(summarizeGroups({ groups })).toStrictEqual([{ packages: [''], pack: 'lightsout/node', source: 'named', rules: ['lightsout/tabs'] }]);
	});

	test('resolveStandardsGroups: standards-pack false returns no group without loading any library', async () => {
		const { cwd } = setupUnloadableRepo();
		const config: LightsoutConfig = { ...baseConfig, 'standards-pack': false, 'standards-libraries': { broken: './missing' } };

		const groups = await resolveStandardsGroups({ cwd, config });

		// both the built-in override and the registered entry would throw if read, so resolving at all proves neither was
		expect(groups).toStrictEqual([]);
	});

	test('resolveStandardsGroups: the group covers the scoped packages plus the repo root', async () => {
		const { workspaceCwd, flatCwd } = setupScopeRepos();

		const [scoped, flat] = await Promise.all([
			resolveStandardsGroups({ cwd: workspaceCwd, config: baseConfig, packages: ['engine'] }),
			resolveStandardsGroups({ cwd: flatCwd, config: baseConfig }),
		]);

		expect({ scoped: scoped.map((group) => group.packages), flat: flat.map((group) => group.packages) }).toStrictEqual({
			scoped: [['', 'engine']],
			flat: [['']],
		});
	});

	test('resolveStandardsGroups: repo rule settings are applied as the last layer and an unknown name fails', async () => {
		const { cwd } = setupRepo();
		const config: LightsoutConfig = { ...baseConfig, 'standards-rule-settings': { tabs: 'advisory' } };
		const unknown: LightsoutConfig = { ...baseConfig, 'standards-rule-settings': { 'no-such-rule': 'advisory' } };

		const [groups, error] = await Promise.all([
			resolveStandardsGroups({ cwd, config }),
			getRejectionError({ promise: resolveStandardsGroups({ cwd, config: unknown }) }),
		]);

		// the pack ships tabs at its rule.md default, blocking, so advisory can only come from the repo's layer
		expect(groups[0]?.states.get('lightsout/tabs')).toEqual(expect.objectContaining({ severity: 'advisory', fromConfig: true }));
		expect(error.message).toContain('no-such-rule');
	});

	test('a repo with no config gets the detected pack over the default packages folder, and packages-dir moves that folder', async () => {
		const { defaultCwd, appsCwd } = setupPackagesDirRepos();

		const [unconfigured, apps] = await Promise.all([
			resolveStandardsGroups({ cwd: defaultCwd, config: undefined }),
			resolveStandardsGroups({ cwd: appsCwd, config: { ...baseConfig, 'packages-dir': 'apps' } }),
		]);

		expect({ unconfigured: summarizeGroups({ groups: unconfigured }), apps: apps.map((group) => group.packages) }).toStrictEqual({
			unconfigured: [{ packages: ['', 'engine'], pack: 'lightsout/node', source: 'detected', rules: ['lightsout/tabs'] }],
			apps: [['', 'site']],
		});
	});

	test('two rule settings naming one rule, by short and by full name, fail and name both', async () => {
		const { cwd } = setupRepo();
		const config: LightsoutConfig = { ...baseConfig, 'standards-rule-settings': { tabs: 'advisory', 'lightsout/tabs': 'off' } };

		const error = await getRejectionError({ promise: resolveStandardsGroups({ cwd, config }) });

		// two answers for one rule leave its severity to key order, so neither is taken
		expect(error.message).toEqual(expect.stringMatching(/standards-rule-settings.*"tabs".*"lightsout\/tabs"/));
	});

	test('resolveStandardsGroups: a named pack that does not exist fails and names the pack', async () => {
		const { cwd } = setupRepo();
		const config: LightsoutConfig = { ...baseConfig, 'standards-pack': 'lightsout/ghost' };

		const error = await getRejectionError({ promise: resolveStandardsGroups({ cwd, config }) });

		expect(error.message).toContain('lightsout/ghost');
	});
});
