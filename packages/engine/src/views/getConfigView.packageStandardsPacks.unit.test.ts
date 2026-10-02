import { describe, expect, test } from '@jest/globals';
import { getConfigView } from '#src/views/getConfigView.ts';
import { seedConfiguredCwd } from '#tests/helpers/seedConfiguredCwd.ts';
import { writeRepoFile } from '#tests/helpers/writeRepoFile.ts';

/** The root's manifest and one per workspace package, each declaring `dependencies[name]` — '' is the root — and no framework otherwise. */
const writeManifests = ({ cwd, dependencies = {} }: { cwd: string; dependencies?: Record<string, Record<string, string>> }) => {
	const manifests = [
		{ path: 'package.json', name: '' },
		{ path: 'packages/engine/package.json', name: 'engine' },
		{ path: 'packages/web-app/package.json', name: 'web-app' },
	];

	for (const { path, name } of manifests) {
		writeRepoFile({ cwd, path, content: JSON.stringify({ name: `@acme/${name || 'root'}`, dependencies: { zod: '^4.0.0', ...dependencies[name] } }) });
	}
};

/**
 * A monorepo of `engine` and `web-app` on the repo's node pack, where web-app
 * alone is given the react pack through `package-standards-packs` and declares
 * react, which is what that pack's conditional react rules need to apply.
 */
const setupPackagePacks = async () => {
	const cwd = await seedConfiguredCwd({
		config: { 'standards-pack': 'lightsout/node', 'package-standards-packs': { 'web-app': 'lightsout/react-app' } },
	});

	writeManifests({ cwd, dependencies: { 'web-app': { react: '^19.0.0' } } });

	return { cwd };
};

/** One rule folder's files: its markdown plus the fixture pair every rule ships. */
const ruleFiles = ({ path, summary }: { path: string; summary: string }) => ({
	[`${path}/rule.md`]: `---\nsummary: ${summary}\n---\n\n${summary} — the rule's prose.\n`,
	[`${path}/fixtures/pass/src/example.ts`]: 'export const example = 1;\n',
	[`${path}/fixtures/fail/src/example.ts`]: 'export const example = 2;\n',
});

/** A `house` library whose `base` pack applies everywhere and whose `react` pack applies only to a package declaring react. */
const houseLibraryFiles = {
	'standards/house/lightsout-standards.json': '{ "name": "house", "formatVersion": 2 }\n',
	'standards/house/rules/code/base/topic.md': '# Base\n\nHow every package writes code.\n',
	...ruleFiles({ path: 'standards/house/rules/code/base/01-tabs', summary: 'indent with tabs' }),
	'standards/house/rules/code/react/topic.md': '# React\n\nHow components are written.\n',
	...ruleFiles({ path: 'standards/house/rules/code/react/01-hooks-first', summary: 'hooks come before handlers' }),
	'standards/house/packs/base.json': JSON.stringify({ description: 'The base pack.', include: { topics: ['house/code/base'] } }),
	'standards/house/packs/react.json': JSON.stringify({
		description: 'The react pack.',
		include: { topics: ['house/code/react'] },
		'applies-when': { dependencies: ['react'] },
	}),
};

/**
 * The same monorepo with every package on `house/base` plus the conditional
 * `house/react`, where only web-app's manifest declares react.
 */
const setupConditionalPacks = async () => {
	const cwd = await seedConfiguredCwd({
		config: { 'standards-libraries': { house: './standards/house' }, 'standards-pack': ['house/base', 'house/react'] },
	});

	for (const [path, content] of Object.entries(houseLibraryFiles)) {
		writeRepoFile({ cwd, path, content });
	}

	writeManifests({ cwd, dependencies: { 'web-app': { react: '^19.0.0' } } });

	return { cwd };
};

describe('getConfigView', () => {
	test("states each group's pack, conditional packs and packages, and each rule state's packages", async () => {
		const { cwd } = await setupPackagePacks();

		const view = await getConfigView({ cwd });

		// the listing's package order is not the view's to decide, so each set is
		// compared sorted; the label is the one the engine prints for that set
		const packageSets = [...new Set(view.ruleStates.map((state) => JSON.stringify({ packages: [...state.packages].sort(), appliesTo: state.appliesTo })))];
		const findState = (rule: string) => view.ruleStates.find((state) => state.rule === rule);
		expect({
			standardsGroups: view.standardsGroups,
			packageSets: packageSets.map((entry) => JSON.parse(entry)).sort((left, right) => right.packages.length - left.packages.length),
			fileSize: { packages: [...(findState('lightsout/file-size')?.packages ?? [])].sort(), appliesTo: findState('lightsout/file-size')?.appliesTo },
			componentFileStructure: {
				packages: findState('lightsout/component-file-structure')?.packages,
				appliesTo: findState('lightsout/component-file-structure')?.appliesTo,
			},
		}).toStrictEqual({
			standardsGroups: [
				{ packages: ['', 'engine'], appliesTo: 'repo root (outside packages), engine', pack: 'lightsout/node', conditionalPacks: [] },
				{ packages: ['web-app'], appliesTo: 'web-app', pack: 'lightsout/react-app', conditionalPacks: ['lightsout/react'] },
			],
			packageSets: [
				{ packages: ['', 'engine', 'web-app'], appliesTo: 'repo root (outside packages), engine, web-app' },
				{ packages: ['web-app'], appliesTo: 'web-app' },
			],
			fileSize: { packages: ['', 'engine', 'web-app'], appliesTo: 'repo root (outside packages), engine, web-app' },
			componentFileStructure: { packages: ['web-app'], appliesTo: 'web-app' },
		});
	});

	test('names a list of packs joined in listed order, and the conditional packs that applied to each group', async () => {
		const { cwd } = await setupConditionalPacks();

		const view = await getConfigView({ cwd });

		// only web-app declares react, so house/react applied there alone and its rule holds for no other package
		expect({
			standardsGroups: view.standardsGroups,
			ruleStates: view.ruleStates.map(({ rule, packages }) => ({ rule, packages: [...packages].sort() })),
		}).toStrictEqual({
			standardsGroups: [
				{ packages: ['', 'engine'], appliesTo: 'repo root (outside packages), engine', pack: 'house/base + house/react', conditionalPacks: [] },
				{ packages: ['web-app'], appliesTo: 'web-app', pack: 'house/base + house/react', conditionalPacks: ['house/react'] },
			],
			ruleStates: [
				{ rule: 'house/hooks-first', packages: ['web-app'] },
				{ rule: 'house/tabs', packages: ['', 'engine', 'web-app'] },
			],
		});
	});
});
