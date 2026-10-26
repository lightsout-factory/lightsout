/**
 * The `source-files` globs the engine's own fixture repos are written to: the
 * JS/TS code a fixture plants, its tests included, never the dependencies a
 * fixture links in or declaration files. Fixture repos declare them, so a test
 * never leans on the engine's defaults by accident.
 */
export const sourceFileGlobs = ['**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}', '!**/node_modules/**', '!**/*.d.ts'];
