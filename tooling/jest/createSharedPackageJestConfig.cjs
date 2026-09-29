const createJestConfig = require('./createJestConfig.cjs');

/**
 * The shared packages carry the same coverage bar as the engine because
 * everything else builds against them. Their small denominator makes a dip look
 * sharp, which is a reason to read it carefully, not to set the bar lower.
 */
module.exports = ({ rootDir }) =>
	createJestConfig({
		rootDir,
		testMatch: ['<rootDir>/src/**/*.unit.test.ts'],
		collectCoverageFrom: ['src/**/*.ts', '!src/**/*.unit.test.ts'],
		coverageThreshold: { global: { statements: 95, branches: 95, functions: 95, lines: 95 } },
	});
