/**
 * The `test-files` globs the engine's own fixture repos are written to: tests
 * named `*.test.*` or `*.spec.*`, and the folders the fixtures keep test
 * support in. A fixture repo is a repo like any other, so it declares its test
 * files rather than leaning on a convention the engine does not hold.
 */
export const testFileGlobs = ['**/*.test.*', '**/*.spec.*', '**/test/**', '**/tests/**', '**/__tests__/**', '**/__mocks__/**', '**/e2e/**'];
