/**
 * The test files of a JS/TS repo as the common runners name them: `*.test.*`
 * and `*.spec.*` files, and the folders test support lives in. A repo whose
 * runner is configured otherwise sets `test-files`.
 */
export const defaultTestFileGlobs = ['**/*.test.*', '**/*.spec.*', '**/test/**', '**/tests/**', '**/__tests__/**', '**/__mocks__/**', '**/e2e/**'];
