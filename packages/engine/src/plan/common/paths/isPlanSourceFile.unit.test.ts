import { describe, expect, test } from '@jest/globals';
import { isPlanSourceFile } from '#src/plan/common/paths/isPlanSourceFile.ts';
import { sourceFileGlobs } from '#tests/helpers/sourceFileGlobs.ts';
import { testFileGlobs } from '#tests/helpers/testFileGlobs.ts';

describe('isPlanSourceFile', () => {
	test.each(['src/plan/parsePlan/parsePlan.ts', 'packages/engine/src/cli/main.tsx'])('an ordinary module counts toward a plan size number: %s', (path) => {
		const counts = isPlanSourceFile({ path, fileGlobs: { source: sourceFileGlobs, tests: testFileGlobs } });

		expect(counts).toBe(true);
	});

	test('a hand-authored type-only module counts, because it still has to be specified and written', () => {
		const counts = isPlanSourceFile({ path: 'src/plan/common/types/PhaseFile.ts', fileGlobs: { source: sourceFileGlobs, tests: testFileGlobs } });

		// the template tells the drafter this in the same words — a drafter who
		// excluded type-only modules would under-count every phase
		expect(counts).toBe(true);
	});

	test.each(['src/plan/parsePlan/parsePlan.unit.test.ts', 'src/plan/parsePlan.spec.ts', 'tests/helpers/setupConsumerRepo.ts', 'src/__mocks__/driver.ts'])(
		"a file the repo's test-files globs match does not count: %s",
		(path) => {
			const counts = isPlanSourceFile({ path, fileGlobs: { source: sourceFileGlobs, tests: testFileGlobs } });

			expect(counts).toBe(false);
		},
	);

	test('a test-named file counts when the repo declares no test-files globs', () => {
		const counts = isPlanSourceFile({ path: 'src/plan/parsePlan/parsePlan.unit.test.ts', fileGlobs: { source: sourceFileGlobs, tests: [] } });

		expect(counts).toBe(true);
	});

	test.each(['index.js', 'src/plan/index.ts', 'src/cli/index.tsx'])('an index file counts like any other code file the globs name: %s', (path) => {
		const counts = isPlanSourceFile({ path, fileGlobs: { source: sourceFileGlobs, tests: testFileGlobs } });

		expect(counts).toBe(true);
	});

	test('an index file does not count when the source-files globs exclude it', () => {
		const counts = isPlanSourceFile({ path: 'src/plan/index.ts', fileGlobs: { source: [...sourceFileGlobs, '!**/index.*'], tests: testFileGlobs } });

		expect(counts).toBe(false);
	});

	test('a declaration file does not count when the source-files globs exclude it', () => {
		const counts = isPlanSourceFile({ path: 'src/markdown.d.ts', fileGlobs: { source: sourceFileGlobs, tests: testFileGlobs } });

		// sourceFileGlobs carries `!**/*.d.ts`
		expect(counts).toBe(false);
	});

	test('a declaration file counts when the source-files globs do not exclude it', () => {
		const counts = isPlanSourceFile({ path: 'src/markdown.d.ts', fileGlobs: { source: ['**/*.ts'], tests: testFileGlobs } });

		expect(counts).toBe(true);
	});

	test('a file the source-files globs do not name does not count', () => {
		const counts = isPlanSourceFile({ path: 'README.md', fileGlobs: { source: sourceFileGlobs, tests: testFileGlobs } });

		expect(counts).toBe(false);
	});

	test('nothing counts when the repo declares no source-files globs', () => {
		const counts = isPlanSourceFile({ path: 'src/plan/parsePlan/parsePlan.ts', fileGlobs: { source: [], tests: testFileGlobs } });

		expect(counts).toBe(false);
	});
});
