const createJestConfig = require('../../tooling/jest/createJestConfig.cjs');

module.exports = createJestConfig({
	rootDir: __dirname,
	testMatch: ['<rootDir>/src/**/*.unit.test.ts'],
	// Jest only instruments files a test reaches, so an untested module would
	// otherwise be left out of the average instead of dragging it down.
	collectCoverageFrom: ['src/**/*.ts', '!src/**/*.unit.test.ts', '!src/**/*.d.ts'],
	coverageThreshold: { global: { statements: 95, branches: 95, functions: 95, lines: 95 } },
});
