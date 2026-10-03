import { describe, expect, test } from '@jest/globals';
import { setupFileTextInput, setupImportGraphInput } from '@lightsout/standards-testkit';
import { check } from './check.ts';

describe('index-files check', () => {
	test('asks for the import graph and the file text: one says who imports through an index file, the other which index files are no entry', () => {
		expect(check.inputKinds).toStrictEqual(['import-graph', 'file-text']);
	});

	test('reports both halves in one run, an import through a folder index and the index itself', async () => {
		const edges = [
			{ from: 'src/ingestion/index.ts', to: 'src/ingestion/ingestRecords.ts' },
			{ from: 'src/reporting/buildReport.ts', to: 'src/ingestion/index.ts' },
		];
		const paths = ['src/ingestion/index.ts', 'src/ingestion/ingestRecords.ts', 'src/reporting/buildReport.ts'];
		const inputs = {
			'import-graph': setupImportGraphInput({ edges, referenceFiles: paths }),
			'file-text': setupFileTextInput({ contents: paths.map((path): [string, string] => [path, "export { a } from './a';"]) }),
		};

		const findings = await check.run({ inputs, options: {} });

		expect(findings.map(({ siteKey }) => siteKey)).toStrictEqual([
			'index-files:src/ingestion/index.ts|src/reporting/buildReport.ts',
			'index-files:src/ingestion/index.ts',
		]);
	});

	test('answers nothing when both inputs are missing', async () => {
		const findings = await check.run({ inputs: {}, options: {} });

		expect(findings).toStrictEqual([]);
	});
});
