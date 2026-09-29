const createJestConfig = require('../../tooling/jest/createJestConfig.cjs');

// rootDir is the package, so a standards package is testable on its own
// without the engine's repo around it, and the committed build copy at
// plugin/standards/ sits outside the project entirely.
module.exports = createJestConfig({
	rootDir: __dirname,
	testMatch: ['<rootDir>/**/*.unit.test.ts'],
	coverageThreshold: { global: { statements: 95, branches: 95, functions: 95, lines: 95 } },
	// Measure every check and helper, not just the ones a test imports: a rule
	// whose check has no test should score zero, which is the gap this gate
	// exists to catch.
	//
	// Fixtures are excluded: they are example files a check READS, and the
	// failing side deliberately violates the rule it proves.
	collectCoverageFrom: ['**/*.ts', '!**/*.unit.test.ts', '!**/fixtures/**'],
});
