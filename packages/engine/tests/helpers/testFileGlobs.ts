/**
 * The `test-files` globs the engine's own fixture repos are written to: tests
 * named `*.test.*` or `*.spec.*`, and the folders the fixtures keep test
 * support in. Fixture repos declare them, so a test never leans on the
 * engine's defaults by accident.
 */
export const testFileGlobs = ['**/*.test.*', '**/*.spec.*', '**/test/**', '**/tests/**', '**/__tests__/**', '**/__mocks__/**', '**/e2e/**'];
