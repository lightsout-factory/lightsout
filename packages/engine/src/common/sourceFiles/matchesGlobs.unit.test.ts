import { describe, expect, test } from '@jest/globals';
import { matchesGlobs } from '#src/common/sourceFiles/matchesGlobs.ts';

describe('matchesGlobs', () => {
	test('a path matches when any glob includes it and no ! glob excludes it', () => {
		const globs = ['src/**/*.ts', 'lib/**/*.js', '!**/*.d.ts'];

		expect(['src/a.ts', 'lib/b.js', 'src/types.d.ts', 'docs/c.md'].map((path) => matchesGlobs({ path, globs }))).toStrictEqual([true, true, false, false]);
	});

	test('a list of only ! globs includes nothing', () => {
		expect(matchesGlobs({ path: 'src/a.ts', globs: ['!**/*.d.ts'] })).toBe(false);
	});

	test('an empty list matches nothing', () => {
		expect(matchesGlobs({ path: 'src/a.ts', globs: [] })).toBe(false);
	});
});
