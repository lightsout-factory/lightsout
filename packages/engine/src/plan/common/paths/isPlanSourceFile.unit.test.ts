import { describe, expect, test } from '@jest/globals';
import { isPlanSourceFile } from '#src/plan/common/paths/isPlanSourceFile.ts';
import { testFileGlobs } from '#tests/helpers/testFileGlobs.ts';

describe('isPlanSourceFile', () => {
	test.each(['src/plan/parsePlan/parsePlan.ts', 'packages/engine/src/cli/main.tsx'])('an ordinary module counts toward a plan size number: %s', (path) => {
		const counts = isPlanSourceFile({ path, testFileGlobs });

		expect(counts).toBe(true);
	});

	test('a hand-authored type-only module counts, because it still has to be specified and written', () => {
		const counts = isPlanSourceFile({ path: 'src/plan/common/types/PhaseFile.ts', testFileGlobs });

		// the template tells the drafter this in the same words — a drafter who
		// excluded type-only modules would under-count every phase
		expect(counts).toBe(true);
	});

	test.each(['src/plan/parsePlan/parsePlan.unit.test.ts', 'src/plan/parsePlan.spec.ts', 'tests/helpers/setupConsumerRepo.ts', 'src/__mocks__/driver.ts'])(
		"a file the repo's test-files globs match does not count: %s",
		(path) => {
			const counts = isPlanSourceFile({ path, testFileGlobs });

			expect(counts).toBe(false);
		},
	);

	test('a test-named file counts when the repo declares no test-files globs', () => {
		const counts = isPlanSourceFile({ path: 'src/plan/parsePlan/parsePlan.unit.test.ts', testFileGlobs: [] });

		expect(counts).toBe(true);
	});

	test.each(['index.js', 'src/plan/index.ts', 'src/cli/index.tsx'])('a barrel does not count: %s', (path) => {
		const counts = isPlanSourceFile({ path, testFileGlobs });

		expect(counts).toBe(false);
	});

	test.each(['src/indexer.ts', 'src/planIndex.ts'])('a file whose name merely contains "index" is not a barrel: %s', (path) => {
		const counts = isPlanSourceFile({ path, testFileGlobs });

		expect(counts).toBe(true);
	});

	test('a declaration file does not count', () => {
		const counts = isPlanSourceFile({ path: 'src/markdown.d.ts', testFileGlobs });

		expect(counts).toBe(false);
	});
});
