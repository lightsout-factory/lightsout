/**
 * The `source-files` globs the engine's own fixture repos are written to: the
 * JS/TS code a fixture plants, its tests included, never the dependencies a
 * fixture links in or declaration files. A fixture repo is a repo like any
 * other, so it declares its code rather than leaning on a walk that guesses.
 */
export const sourceFileGlobs = ['**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}', '!**/node_modules/**', '!**/*.d.ts'];
