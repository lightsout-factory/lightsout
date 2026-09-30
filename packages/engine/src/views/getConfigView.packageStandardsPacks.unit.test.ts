import { describe, expect, test } from '@jest/globals';
import { getConfigView } from '#src/views/getConfigView.ts';
import { seedConfiguredCwd } from '#tests/helpers/seedConfiguredCwd.ts';
import { writeRepoFile } from '#tests/helpers/writeRepoFile.ts';

/**
 * A monorepo of `engine` and `web-app` whose manifests, like the root's, declare
 * no framework — so detection can only pick the node pack, and web-app's react
 * pack can only have come from `package-standards-packs`.
 */
const setupPackagePacks = async () => {
	const cwd = await seedConfiguredCwd({ config: { 'package-standards-packs': { 'web-app': 'lightsout/react-app' } } });
	const manifests = [
		{ path: 'package.json', name: 'root' },
		{ path: 'packages/engine/package.json', name: '@acme/engine' },
		{ path: 'packages/web-app/package.json', name: '@acme/web-app' },
	];

	for (const { path, name } of manifests) {
		writeRepoFile({ cwd, path, content: JSON.stringify({ name, dependencies: { zod: '^4.0.0' } }) });
	}

	return { cwd };
};

describe('getConfigView', () => {
	test("states each group's pack, source and packages, and each rule state's packages", async () => {
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
				{ packages: ['', 'engine'], appliesTo: 'repo root (outside packages), engine', pack: 'lightsout/node', source: 'detected' },
				{ packages: ['web-app'], appliesTo: 'web-app', pack: 'lightsout/react-app', source: 'named' },
			],
			packageSets: [
				{ packages: ['', 'engine', 'web-app'], appliesTo: 'repo root (outside packages), engine, web-app' },
				{ packages: ['web-app'], appliesTo: 'web-app' },
			],
			fileSize: { packages: ['', 'engine', 'web-app'], appliesTo: 'repo root (outside packages), engine, web-app' },
			componentFileStructure: { packages: ['web-app'], appliesTo: 'web-app' },
		});
	});
});
