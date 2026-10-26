import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from '@jest/globals';
import { StandardsInputKind } from '@lightsout/standards-contracts';
import { runPackageChecks } from '#src/standardsCheck/runStandardsCheck/runPackageChecks/runPackageChecks.ts';
import { linkTypescript } from '#tests/helpers/linkTypescript.ts';
import { loadOneRule } from '#tests/helpers/loadOneRule.ts';
import { sourceFileGlobs } from '#tests/helpers/sourceFileGlobs.ts';
import { testFileGlobs } from '#tests/helpers/testFileGlobs.ts';

/** A repo where one file imports another, with a typescript to borrow, checked by a rule that declared the import-graph kind. */
const setupImportGraphRun = () => {
	const cwd = mkdtempSync(join(tmpdir(), 'lightsout-check-inputs-graph-'));

	mkdirSync(join(cwd, 'src/feature'), { recursive: true });
	writeFileSync(join(cwd, 'src/feature/internal.ts'), 'export const internal = 1;\n');
	writeFileSync(join(cwd, 'src/consumer.ts'), "import { internal } from './feature/internal.ts';\n\nexport const consumer = () => internal;\n");
	linkTypescript({ dir: cwd });

	return { cwd, ...loadOneRule({ inputKinds: [StandardsInputKind.ImportGraph] }) };
};

/**
 * A repo whose root and one workspace package each ship a manifest, checked by
 * a rule that declared the import-graph kind. The package parent dir is the
 * test's to name: a repo that keeps its packages elsewhere says so in config.
 */
const setupImportGraphDependenciesRun = ({ packagesDir }: { packagesDir: string }) => {
	const cwd = mkdtempSync(join(tmpdir(), 'lightsout-check-inputs-graph-deps-'));

	mkdirSync(join(cwd, 'src'), { recursive: true });
	mkdirSync(join(cwd, packagesDir, 'web'), { recursive: true });
	writeFileSync(join(cwd, 'src/consumer.ts'), 'export const consumer = 1;\n');
	writeFileSync(join(cwd, 'package.json'), '{ "name": "root" }\n');
	writeFileSync(join(cwd, packagesDir, 'web/package.json'), '{ "name": "web", "dependencies": { "@tanstack/react-router": "^1" } }\n');
	linkTypescript({ dir: cwd });

	return { cwd, packagesDir, ...loadOneRule({ inputKinds: [StandardsInputKind.ImportGraph] }) };
};

describe('runPackageChecks', () => {
	test('hands an import-graph rule what each package declares, so a boundary rule can tell a framework-mandated folder from one the repo chose', async () => {
		const { cwd, handed, groups } = setupImportGraphDependenciesRun({ packagesDir: 'packages' });

		const { notes } = await runPackageChecks({ cwd, sourceFileGlobs, testFileGlobs, groups });

		// an empty note list is what says the compiler resolved: the kind needs one,
		// and a run without it skips the rule instead of building this
		expect(notes).toStrictEqual([]);
		// a carve-out is keyed on what a package DECLARES, and the graph cannot show
		// it — a root that declares nothing still gets an entry, so a rule reading
		// the map never has to tell "no manifest" from "no dependencies"
		expect(handed[0]?.['import-graph']).toEqual(
			expect.objectContaining({
				kind: 'import-graph',
				dependencies: new Map([
					['.', []],
					['packages/web', ['@tanstack/react-router']],
				]),
			}),
		);
	});

	test('reads those declarations from the package parent dir the run was configured with, not the default name', async () => {
		const { cwd, packagesDir, handed, groups } = setupImportGraphDependenciesRun({ packagesDir: 'modules' });

		await runPackageChecks({ cwd, sourceFileGlobs, testFileGlobs, groups, packagesDir });

		// a repo that keeps its packages under another name would otherwise have
		// every workspace manifest fall out of the map, silently
		expect(handed[0]?.['import-graph']).toEqual(
			expect.objectContaining({
				dependencies: new Map([
					['.', []],
					['modules/web', ['@tanstack/react-router']],
				]),
			}),
		);
	});

	test('hands an import-graph rule the edges resolved among the repo files', async () => {
		const { cwd, handed, groups } = setupImportGraphRun();

		const { notes } = await runPackageChecks({ cwd, sourceFileGlobs, testFileGlobs, groups });

		// an empty note list is what says the compiler resolved: the kind needs one,
		// and a run without it skips the rule instead of building this
		expect(notes).toStrictEqual([]);
		expect(handed[0]?.['import-graph']).toEqual(
			expect.objectContaining({
				kind: 'import-graph',
				files: ['src/consumer.ts', 'src/feature/internal.ts'],
				edges: [{ from: 'src/consumer.ts', to: 'src/feature/internal.ts' }],
			}),
		);
	});
});
