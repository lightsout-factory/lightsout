import { describe, expect, test } from '@jest/globals';
import { isIndexFile } from './isIndexFile.ts';

describe('isIndexFile', () => {
	test.each([
		{ path: 'src/ingestion/index.ts', expected: true },
		{ path: 'src/feature/components/Badge/index.tsx', expected: true },
		{ path: 'src/ingestion/index.js', expected: true },
		{ path: 'src/ingestion/index.jsx', expected: true },
		{ path: 'src/ingestion/index.mjs', expected: true },
		{ path: 'src/ingestion/index.cts', expected: true },
		{ path: 'index.ts', expected: true },
		{ path: 'src/ingestion/ingestRecords.ts', expected: false },
		{ path: 'src/ingestion/index.d.ts', expected: false },
		{ path: 'src/ingestion/index.unit.test.ts', expected: false },
		{ path: 'src/ingestion/reindex.ts', expected: false },
		{ path: 'src/index', expected: false },
	])('$path is $expected', ({ path, expected }) => {
		const isIndex = isIndexFile({ path });

		expect(isIndex).toBe(expected);
	});

	test('a folder named index is not an index file', () => {
		const isIndex = isIndexFile({ path: 'src/index/parseRow.ts' });

		expect(isIndex).toBe(false);
	});
});
