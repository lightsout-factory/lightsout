import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, jest, test } from '@jest/globals';
import type { StandardsGroup } from '#src/common/types/StandardsGroup.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig.ts';
import { resolveStandardsGroups } from '#src/standards/resolveStandardsGroups/resolveStandardsGroups.ts';
import { getRejectionError } from '#tests/helpers/getRejectionError.ts';

const baseConfig: LightsoutConfig = { gates: { check: 'true', test: 'true', 'test-coverage': false } };

/** Standards are opt-in, so a test that wants the root and every package on one pack names it. */
const fractalConfig: LightsoutConfig = { ...baseConfig, 'standards-pack': 'lightsout/fractal' };

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
	[`${path}/rule.md`]: `---\nsummary: ${summary}\nchecks: agent\n---\n\n${summary} — the rule's prose.\n`,
	[`${path}/fixtures/pass/src/example.ts`]: 'export const example = 1;\n',
	[`${path}/fixtures/fail/src/example.ts`]: 'export const example = 2;\n',
});

/**
 * A small built-in `lightsout` library holding the two pack addresses these
 * tests reach: `fractal` (one base topic, rule `tabs`) and `standards` (fractal
 * plus one react topic, rule `hooks-first`), so which pack a group got shows in its
 * rules as well as its name.
 */
const builtInLibraryFiles = {
	'lightsout-standards.json': '{ "name": "lightsout", "formatVersion": 2 }\n',
	'rules/code/base/topic.md': '# Base\n\nHow every package writes code.\n',
	...ruleFiles({ path: 'rules/code/base/01-tabs', summary: 'indent with tabs' }),
	'rules/code/frameworks/react/topic.md': '# React\n\nHow components are written.\n',
	...ruleFiles({ path: 'rules/code/frameworks/react/01-hooks-first', summary: 'hooks come before handlers' }),
	'packs/fractal.json': JSON.stringify({ description: 'The fractal pack.', include: { topics: ['lightsout/code/base'] } }),
	'packs/standards.json': JSON.stringify({
		description: 'The standards pack.',
		include: { packs: ['lightsout/fractal'], topics: ['lightsout/code/frameworks/react'] },
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
		conditionalPacks: group.pack.conditionalPacks,
		rules: group.pack.rules.map(({ rule }) => rule.name).sort(),
	}));

describe('resolveStandardsGroups', () => {
	test('resolveStandardsGroups: with no standards-pack and no package entry, no package gets standards, whatever its manifest declares', async () => {
		const { cwd } = setupRepo({ rootDependencies: { react: '^19.0.0' }, workspacePackages: ['web', 'api'] });

		const groups = await resolveStandardsGroups({ cwd, config: baseConfig });

		// standards are opt-in: react in the root manifest selects nothing
		expect(groups).toStrictEqual([]);
	});

	test('resolveStandardsGroups: the named pack covers the root and every workspace package, whatever the root manifest declares', async () => {
		const { cwd } = setupRepo({ rootDependencies: { react: '^19.0.0' }, workspacePackages: ['web', 'api'] });

		const groups = await resolveStandardsGroups({ cwd, config: fractalConfig });

		expect(summarizeGroups({ groups })).toStrictEqual([
			{ packages: ['', 'api', 'web'], pack: 'lightsout/fractal', conditionalPacks: [], rules: ['lightsout/tabs'] },
		]);
	});

	test('resolveStandardsGroups: a list of packs resolves as one pack named after every address, holding what each brings', async () => {
		const { cwd } = setupRepo();
		const config: LightsoutConfig = { ...baseConfig, 'standards-pack': ['lightsout/fractal', 'lightsout/standards'] };

		const groups = await resolveStandardsGroups({ cwd, config });

		expect(summarizeGroups({ groups })).toStrictEqual([
			{ packages: [''], pack: 'lightsout/fractal + lightsout/standards', conditionalPacks: [], rules: ['lightsout/hooks-first', 'lightsout/tabs'] },
		]);
	});

	test('resolveStandardsGroups: standards-pack false returns no group without loading any library', async () => {
		const { cwd } = setupUnloadableRepo();
		const config: LightsoutConfig = { ...baseConfig, 'standards-pack': false, 'standards-libraries': { broken: './missing' } };

		const groups = await resolveStandardsGroups({ cwd, config });

		// both the built-in override and the registered entry would throw if read, so resolving at all proves neither was
		expect(groups).toStrictEqual([]);
	});

	test('resolveStandardsGroups: rule settings with no standards-pack are refused, naming the key that turns standards on', async () => {
		const { cwd } = setupRepo();
		const config: LightsoutConfig = { ...baseConfig, 'standards-rule-settings': { tabs: 'advisory' } };

		const error = await getRejectionError({ promise: resolveStandardsGroups({ cwd, config }) });

		// settings that would apply to nothing are a repo that meant to have standards, not a quiet no-op
		expect(error.message).toEqual(expect.stringMatching(/standards-rule-settings is set but standards-pack is not.*set "standards-pack" to a pack address/));
	});

	test('resolveStandardsGroups: standards-pack false keeps its rule settings unread, so turning standards off never needs them deleted', async () => {
		const { cwd } = setupRepo();
		const config: LightsoutConfig = { ...baseConfig, 'standards-pack': false, 'standards-rule-settings': { tabs: 'advisory' } };

		const groups = await resolveStandardsGroups({ cwd, config });

		expect(groups).toStrictEqual([]);
	});

	test('resolveStandardsGroups: the group covers the scoped packages plus the repo root', async () => {
		const { workspaceCwd, flatCwd } = setupScopeRepos();

		const [scoped, flat] = await Promise.all([
			resolveStandardsGroups({ cwd: workspaceCwd, config: fractalConfig, packages: ['engine'] }),
			resolveStandardsGroups({ cwd: flatCwd, config: fractalConfig }),
		]);

		expect({ scoped: scoped.map((group) => group.packages), flat: flat.map((group) => group.packages) }).toStrictEqual({
			scoped: [['', 'engine']],
			flat: [['']],
		});
	});

	test('resolveStandardsGroups: repo rule settings are applied as the last layer and an unknown name fails', async () => {
		const { cwd } = setupRepo();
		const config: LightsoutConfig = { ...fractalConfig, 'standards-rule-settings': { tabs: 'advisory' } };
		const unknown: LightsoutConfig = { ...fractalConfig, 'standards-rule-settings': { 'no-such-rule': 'advisory' } };

		const [groups, error] = await Promise.all([
			resolveStandardsGroups({ cwd, config }),
			getRejectionError({ promise: resolveStandardsGroups({ cwd, config: unknown }) }),
		]);

		// the pack ships tabs at its rule.md default, blocking, so advisory can only come from the repo's layer
		expect(groups[0]?.states.get('lightsout/tabs')).toEqual(expect.objectContaining({ severity: 'advisory', fromConfig: true }));
		expect(error.message).toContain('no-such-rule');
	});

	test('a repo with no config gets no standards', async () => {
		const { defaultCwd } = setupPackagesDirRepos();

		const groups = await resolveStandardsGroups({ cwd: defaultCwd, config: undefined });

		expect(groups).toStrictEqual([]);
	});

	test('workspace packages are read from the default packages folder, and packages-dir moves that folder', async () => {
		const { defaultCwd, appsCwd } = setupPackagesDirRepos();

		const [defaults, apps] = await Promise.all([
			resolveStandardsGroups({ cwd: defaultCwd, config: fractalConfig }),
			resolveStandardsGroups({ cwd: appsCwd, config: { ...fractalConfig, 'packages-dir': 'apps' } }),
		]);

		expect({ defaults: summarizeGroups({ groups: defaults }), apps: apps.map((group) => group.packages) }).toStrictEqual({
			defaults: [{ packages: ['', 'engine'], pack: 'lightsout/fractal', conditionalPacks: [], rules: ['lightsout/tabs'] }],
			apps: [['', 'site']],
		});
	});

	test('two rule settings naming one rule, by short and by full name, fail and name both', async () => {
		const { cwd } = setupRepo();
		const config: LightsoutConfig = { ...fractalConfig, 'standards-rule-settings': { tabs: 'advisory', 'lightsout/tabs': 'off' } };

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
