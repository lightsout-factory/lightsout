import { describe, expect, test } from '@jest/globals';
import { isTestFile } from '#src/common/sourceFiles/isTestFile.ts';

describe('isTestFile', () => {
	test('a file is a test exactly when one of the repo’s globs matches it', () => {
		const testFileGlobs = ['**/*.test.*', 'packages/*/tests/**'];

		expect({
			named: isTestFile({ path: 'packages/engine/src/run.unit.test.ts', testFileGlobs }),
			helper: isTestFile({ path: 'packages/engine/tests/helpers/setupRepo.ts', testFileGlobs }),
			source: isTestFile({ path: 'packages/engine/src/run.ts', testFileGlobs }),
			// a tests/ folder the globs do not name is source, whatever it is called
			libraryRule: isTestFile({ path: 'packages/lightsout-standards/rules/tests/fractal/rule.md', testFileGlobs }),
		}).toStrictEqual({ named: true, helper: true, source: false, libraryRule: false });
	});

	test('holds no convention of its own: with no globs, nothing is a test', () => {
		expect(isTestFile({ path: 'src/run.unit.test.ts', testFileGlobs: [] })).toBe(false);
	});

	test('a layout other test runners use is whatever the repo declares', () => {
		const testFileGlobs = ['spec/**', '**/test_*.py'];

		expect({
			spec: isTestFile({ path: 'spec/models/user_spec.rb', testFileGlobs }),
			python: isTestFile({ path: 'app/tests/test_models.py', testFileGlobs }),
			jestNamed: isTestFile({ path: 'src/run.test.ts', testFileGlobs }),
		}).toStrictEqual({ spec: true, python: true, jestNamed: false });
	});

	test('matches dot-folders too, so a test kept under one is not missed', () => {
		expect(isTestFile({ path: '.storybook/preview.test.ts', testFileGlobs: ['**/*.test.*'] })).toBe(true);
	});
});
