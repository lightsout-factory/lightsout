const { join } = require('node:path');
const createJestConfig = require('../../tooling/jest/createJestConfig.cjs');

// No `moduleNameMapper` for `#src`: several workspace packages spell their
// private alias the same way, and a mapper is project-global — it would rewrite
// the engine's own `#src` imports onto this package's src/. Jest resolves
// package `imports` from the manifest owning the importing file instead.
module.exports = createJestConfig({
	rootDir: __dirname,
	testEnvironment: 'jsdom',
	// jsdom resolves package exports under the `browser` condition by default,
	// which hands back ESM builds for dependencies the engine reaches (`yaml`
	// ships a browser ESM entry) and breaks the CommonJS loader ts-jest compiles
	// for. These are the conditions this code actually runs under on a server.
	testEnvironmentOptions: { customExportConditions: ['require', 'node'] },
	// `tests/` holds suites that police the source tree as text and so have no
	// subject file to sit beside.
	testMatch: ['<rootDir>/src/**/*.unit.test.ts', '<rootDir>/src/**/*.unit.test.tsx', '<rootDir>/tests/**/*.unit.test.ts', '<rootDir>/tests/**/*.unit.test.tsx'],
	// Re-declares the key the factory sets rather than adding to it: the factory
	// spreads the caller's keys last, so a repeated key replaces instead of
	// merging, and the shared setup file has to be named again to survive.
	setupFilesAfterEnv: [join(__dirname, '..', '..', 'tooling', 'jest', 'setupTestEnvironment.ts'), join(__dirname, 'tests', 'config', 'jest.setup.ts')],
	// Every source file, not just the ones a test imports: a file left out of
	// the report is indistinguishable from one no test ever loaded.
	//
	// Except `src/common/components/ui/` — shadcn/ui components written by their
	// CLI. They are `vendored` in lightsout.config.json, so the engine writes no
	// tests for them, and measuring them would hold the threshold against code
	// nothing is allowed to cover.
	collectCoverageFrom: ['src/**/*.ts', 'src/**/*.tsx', '!src/**/*.unit.test.ts', '!src/**/*.unit.test.tsx', '!src/common/components/ui/**'],
	coverageThreshold: { global: { statements: 95, branches: 95, functions: 95, lines: 95 } },
	// `@tanstack/react-start` and its subpaths publish an `import` condition and
	// nothing else, so Jest's CommonJS resolver cannot load them however it is
	// configured.
	moduleNameMapper: {
		// An image imported with `?url` asks the bundler for its served path, but
		// Jest would hand the binary to the JavaScript parser.
		//
		// Ahead of `#assets` deliberately: Jest stops at the first pattern that
		// matches, and that one would rewrite the specifier to a real `.gif` on
		// disk first.
		'\\.(gif|svg)(\\?.*)?$': join(__dirname, 'tests', 'stubs', 'styleUrl.ts'),
		// Mirrors tsconfig.json `paths` and vite.config.ts `resolve.alias`. Spelled
		// three times rather than once in package.json `imports` because a package
		// import may not escape the package.
		'^#assets/(.*)$': join(__dirname, '..', '..', 'assets', '$1'),
		// Spelled three times for the same reason `#assets` is.
		'^#docs/(.*)$': join(__dirname, '..', '..', 'docs', '$1'),
		'^@tanstack/react-start$': join(__dirname, 'tests', 'stubs', 'tanstackReactStart.ts'),
		'^@tanstack/react-start/client$': join(__dirname, 'tests', 'stubs', 'tanstackReactStartClient.ts'),
		'^@tanstack/react-start/server$': join(__dirname, 'tests', 'stubs', 'tanstackReactStartServer.ts'),
		'^@tanstack/react-start/server-entry$': join(__dirname, 'tests', 'stubs', 'tanstackReactStartServerEntry.ts'),
		// `?url` on a stylesheet import is a Vite instruction rather than a module
		// reference, so nothing matching that specifier exists on disk and the root
		// route cannot be required without a stand-in.
		'\\.css(\\?.*)?$': join(__dirname, 'tests', 'stubs', 'styleUrl.ts'),
		// ESM-only, and the shared transform compiles only `.ts`, `.tsx` and `.md`.
		// What this app owns is the `components` map, which the stubs call through.
		'^react-markdown$': join(__dirname, 'tests', 'stubs', 'reactMarkdown.tsx'),
		'^remark-gfm$': join(__dirname, 'tests', 'stubs', 'remarkGfm.ts'),
	},
});
