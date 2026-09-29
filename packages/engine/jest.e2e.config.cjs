const createJestConfig = require('../../tooling/jest/createJestConfig.cjs');

// Separate from the unit config because the globalSetup builds a bundle, a cost
// every unit run should not pay.
module.exports = createJestConfig({
	rootDir: __dirname,
	testMatch: ['<rootDir>/tests/**/*.test.ts'],
	globalSetup: '<rootDir>/tests/config/buildCliUnderTest.cjs',
});
