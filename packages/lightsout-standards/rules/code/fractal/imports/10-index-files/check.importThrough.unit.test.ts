import { describe, expect, test } from '@jest/globals';
import { setupFileTextInput, setupImportGraphInput } from '@lightsout/standards-testkit';
import { check } from './check.ts';

/**
 * The resolved import edges an import-graph rule receives, over a repo whose
 * every file is listed as a reference — `scope` narrows the run to a handful of
 * files while the boundaries stay mapped from the whole repo.
 */
const setupRepo = ({
	paths,
	edges,
	scope,
	standardsLibraries = [],
	dependencies = [],
}: {
	paths: string[];
	edges: Array<{ from: string; to: string }>;
	scope?: string[];
	standardsLibraries?: string[];
	dependencies?: Array<[string, string[]]>;
}) => {
	return setupImportGraphInput({ edges, dependencies, source: scope ?? paths, files: scope ?? paths, referenceFiles: paths, standardsLibraries });
};

/** The ingestion folder most cases below build on: its index file lists `ingestRecords.ts`. */
const ingestionPaths = ['src/reporting/buildReport.ts', 'src/ingestion/index.ts', 'src/ingestion/ingestRecords.ts', 'src/ingestion/parseRow.ts'];
const ingestionIndexEdge = { from: 'src/ingestion/index.ts', to: 'src/ingestion/ingestRecords.ts' };

const throughIndexGuidance = 'An index file lists what a package makes public; nothing inside the package imports through it.';

describe('index-files check: imports through an index file', () => {
	test('reports a file importing through another module’s index file', async () => {
		const input = setupRepo({
			paths: ingestionPaths,
			edges: [ingestionIndexEdge, { from: 'src/reporting/buildReport.ts', to: 'src/ingestion/index.ts' }],
		});

		const findings = await check.run({ inputs: { 'import-graph': input }, options: {} });

		expect(findings).toStrictEqual([
			{
				siteKey: 'index-files:src/ingestion/index.ts|src/reporting/buildReport.ts',
				files: [{ path: 'src/reporting/buildReport.ts' }, { path: 'src/ingestion/index.ts' }],
				detail: "imports through 'src/ingestion/index.ts' — import each name from the file that declares it instead",
				guidance: throughIndexGuidance,
			},
		]);
	});

	test('reports a module’s own file importing through its own index file', async () => {
		const input = setupRepo({
			paths: ingestionPaths,
			edges: [ingestionIndexEdge, { from: 'src/ingestion/parseRow.ts', to: 'src/ingestion/index.ts' }],
		});

		const findings = await check.run({ inputs: { 'import-graph': input }, options: {} });

		expect(findings).toStrictEqual([
			{
				siteKey: 'index-files:src/ingestion/index.ts|src/ingestion/parseRow.ts',
				files: [{ path: 'src/ingestion/parseRow.ts' }, { path: 'src/ingestion/index.ts' }],
				detail: "imports through 'src/ingestion/index.ts' — import each name from the file that declares it instead",
				guidance: throughIndexGuidance,
			},
		]);
	});

	test('reports an import through a folder index file that marks no module, since no import goes through any index file', async () => {
		const input = setupRepo({
			paths: ['src/reporting/buildReport.ts', 'src/helpers/index.ts', 'src/helpers/formatDate.ts'],
			edges: [
				{ from: 'src/helpers/index.ts', to: 'src/helpers/formatDate.ts' },
				{ from: 'src/reporting/buildReport.ts', to: 'src/helpers/index.ts' },
			],
		});

		const findings = await check.run({ inputs: { 'import-graph': input }, options: {} });

		expect(findings).toStrictEqual([
			{
				siteKey: 'index-files:src/helpers/index.ts|src/reporting/buildReport.ts',
				files: [{ path: 'src/reporting/buildReport.ts' }, { path: 'src/helpers/index.ts' }],
				detail: "imports through 'src/helpers/index.ts' — import each name from the file that declares it instead",
				guidance: throughIndexGuidance,
			},
		]);
	});

	test('names every index file one file imports through in a single finding — one edit, one finding', async () => {
		const input = setupRepo({
			paths: [...ingestionPaths, 'src/helpers/index.ts', 'src/helpers/formatDate.ts'],
			edges: [
				ingestionIndexEdge,
				{ from: 'src/helpers/index.ts', to: 'src/helpers/formatDate.ts' },
				{ from: 'src/reporting/buildReport.ts', to: 'src/ingestion/index.ts' },
				{ from: 'src/reporting/buildReport.ts', to: 'src/helpers/index.ts' },
				{ from: 'src/reporting/buildReport.ts', to: 'src/helpers/index.ts' },
			],
		});

		const findings = await check.run({ inputs: { 'import-graph': input }, options: {} });

		expect(findings).toStrictEqual([
			{
				siteKey: 'index-files:src/helpers/index.ts|src/ingestion/index.ts|src/reporting/buildReport.ts',
				files: [{ path: 'src/reporting/buildReport.ts' }, { path: 'src/ingestion/index.ts' }, { path: 'src/helpers/index.ts' }],
				detail: "imports through 'src/ingestion/index.ts', 'src/helpers/index.ts' — import each name from the file that declares it instead",
				guidance: throughIndexGuidance,
			},
		]);
	});

	test('accepts an index file re-exporting from a lower index file', async () => {
		const input = setupRepo({
			paths: [
				'src/ingestion/index.ts',
				'src/ingestion/ingestRecords.ts',
				'src/ingestion/parser/index.ts',
				'src/ingestion/parser/parseRow.ts',
				'src/ingestion/parser/tokenize.ts',
			],
			edges: [
				{ from: 'src/ingestion/index.ts', to: 'src/ingestion/ingestRecords.ts' },
				{ from: 'src/ingestion/index.ts', to: 'src/ingestion/parser/index.ts' },
				{ from: 'src/ingestion/parser/index.ts', to: 'src/ingestion/parser/parseRow.ts' },
			],
		});

		const findings = await check.run({ inputs: { 'import-graph': input }, options: {} });

		expect(findings).toStrictEqual([]);
	});

	test('accepts an index file’s own test importing the index file it tests', async () => {
		const input = setupRepo({
			paths: [...ingestionPaths, 'src/ingestion/index.unit.test.ts'],
			edges: [ingestionIndexEdge, { from: 'src/ingestion/index.unit.test.ts', to: 'src/ingestion/index.ts' }],
		});

		const findings = await check.run({ inputs: { 'import-graph': input }, options: {} });

		expect(findings).toStrictEqual([]);
	});

	test('reports a test beside another file importing its module’s index file', async () => {
		const input = setupRepo({
			paths: [...ingestionPaths, 'src/ingestion/ingestRecords.unit.test.ts'],
			edges: [ingestionIndexEdge, { from: 'src/ingestion/ingestRecords.unit.test.ts', to: 'src/ingestion/index.ts' }],
		});

		const findings = await check.run({ inputs: { 'import-graph': input }, options: {} });

		expect(findings).toStrictEqual([
			{
				siteKey: 'index-files:src/ingestion/index.ts|src/ingestion/ingestRecords.unit.test.ts',
				files: [{ path: 'src/ingestion/ingestRecords.unit.test.ts' }, { path: 'src/ingestion/index.ts' }],
				detail: "imports through 'src/ingestion/index.ts' — import each name from the file that declares it instead",
				guidance: throughIndexGuidance,
			},
		]);
	});

	test('reports an import through an index file of the importer’s own package, and leaves another package’s entry alone', async () => {
		const input = setupRepo({
			paths: [
				'packages/web/src/app.ts',
				'packages/web/src/index.ts',
				'packages/web/src/routes/runs.ts',
				'packages/engine/src/index.ts',
				'packages/engine/src/contracts/index.ts',
				'packages/engine/src/contracts/RunStatus.ts',
			],
			edges: [
				{ from: 'packages/engine/src/contracts/index.ts', to: 'packages/engine/src/contracts/RunStatus.ts' },
				{ from: 'packages/web/src/app.ts', to: 'packages/web/src/index.ts' },
				{ from: 'packages/web/src/app.ts', to: 'packages/engine/src/contracts/index.ts' },
				{ from: 'packages/web/src/routes/runs.ts', to: 'packages/engine/src/index.ts' },
			],
			dependencies: [
				['.', []],
				['packages/engine', []],
				['packages/web', []],
			],
		});

		const findings = await check.run({ inputs: { 'import-graph': input }, options: {} });

		expect(findings).toStrictEqual([
			{
				siteKey: 'index-files:packages/web/src/app.ts|packages/web/src/index.ts',
				files: [{ path: 'packages/web/src/app.ts' }, { path: 'packages/web/src/index.ts' }],
				detail: "imports through 'packages/web/src/index.ts' — import each name from the file that declares it instead",
				guidance: throughIndexGuidance,
			},
		]);
	});

	test('reports an import that reaches a file inside another package, and accepts its entry and a file its manifest publishes', async () => {
		const input = setupRepo({
			paths: [
				'packages/web/src/app.ts',
				'packages/engine/src/index.ts',
				'packages/engine/src/testkit.ts',
				'packages/engine/src/runs/startRun.ts',
				'packages/engine/src/runs/stopRun.ts',
			],
			edges: [
				{ from: 'packages/web/src/app.ts', to: 'packages/engine/src/index.ts' },
				{ from: 'packages/web/src/app.ts', to: 'packages/engine/src/testkit.ts' },
				{ from: 'packages/web/src/app.ts', to: 'packages/engine/src/runs/startRun.ts' },
				{ from: 'packages/web/src/app.ts', to: 'packages/engine/src/runs/stopRun.ts' },
			],
			dependencies: [
				['.', []],
				['packages/engine', []],
				['packages/web', []],
			],
		});
		const manifests = setupFileTextInput({
			contents: [['packages/engine/package.json', JSON.stringify({ exports: { '.': './src/index.ts', './testkit': './src/testkit.ts' } })]],
			files: [],
		});

		const findings = await check.run({ inputs: { 'import-graph': input, 'file-text': manifests }, options: {} });

		expect(findings).toStrictEqual([
			{
				siteKey: 'index-files:packages/engine/src/runs/startRun.ts|packages/engine/src/runs/stopRun.ts|packages/web/src/app.ts',
				files: [{ path: 'packages/web/src/app.ts' }, { path: 'packages/engine/src/runs/startRun.ts' }, { path: 'packages/engine/src/runs/stopRun.ts' }],
				detail: "imports 'packages/engine/src/runs/startRun.ts', 'packages/engine/src/runs/stopRun.ts' from inside another package",
				guidance: "Import it from that package's entry, never by a path into its files.",
			},
		]);
	});

	test('leaves an import of a file that belongs to no workspace package alone', async () => {
		const input = setupRepo({
			paths: ['packages/web/src/app.ts', 'tooling/readVersion.ts'],
			edges: [{ from: 'packages/web/src/app.ts', to: 'tooling/readVersion.ts' }],
			dependencies: [
				['.', []],
				['packages/web', []],
			],
		});

		const findings = await check.run({ inputs: { 'import-graph': input }, options: {} });

		expect(findings).toStrictEqual([]);
	});

	test('says nothing about an importer that belongs to no workspace package', async () => {
		const input = setupRepo({
			paths: ['scripts/buildDocs.mjs', 'apps/web/src/ingestion/index.ts', 'apps/web/src/ingestion/ingestRecords.ts'],
			edges: [
				{ from: 'apps/web/src/ingestion/index.ts', to: 'apps/web/src/ingestion/ingestRecords.ts' },
				{ from: 'scripts/buildDocs.mjs', to: 'apps/web/src/ingestion/index.ts' },
			],
			dependencies: [
				['.', []],
				['apps/web', []],
			],
		});

		const findings = await check.run({ inputs: { 'import-graph': input }, options: {} });

		expect(findings).toStrictEqual([]);
	});

	test('judges every file when the manifests declare no workspace package at all', async () => {
		const input = setupRepo({
			paths: ['scripts/buildDocs.mjs', 'apps/web/src/ingestion/index.ts', 'apps/web/src/ingestion/ingestRecords.ts'],
			edges: [
				{ from: 'apps/web/src/ingestion/index.ts', to: 'apps/web/src/ingestion/ingestRecords.ts' },
				{ from: 'scripts/buildDocs.mjs', to: 'apps/web/src/ingestion/index.ts' },
			],
			dependencies: [['.', []]],
		});

		const findings = await check.run({ inputs: { 'import-graph': input }, options: {} });

		expect(findings.map(({ siteKey }) => siteKey)).toStrictEqual(['index-files:apps/web/src/ingestion/index.ts|scripts/buildDocs.mjs']);
	});

	test('judges only the files in scope', async () => {
		const input = setupRepo({
			paths: ingestionPaths,
			edges: [ingestionIndexEdge, { from: 'src/reporting/buildReport.ts', to: 'src/ingestion/index.ts' }],
			scope: ['src/ingestion/parseRow.ts'],
		});

		const findings = await check.run({ inputs: { 'import-graph': input }, options: {} });

		expect(findings).toStrictEqual([]);
	});

	test('answers nothing when its input is missing', async () => {
		const findings = await check.run({ inputs: {}, options: {} });

		expect(findings).toStrictEqual([]);
	});
});
