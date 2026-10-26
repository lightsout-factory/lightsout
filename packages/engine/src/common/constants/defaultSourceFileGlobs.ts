/**
 * The JS/TS code files of a repo, its tests included: every file in those
 * extensions except declaration files and installed dependencies. A repo in
 * another language, or with code these globs miss, sets `source-files`.
 */
export const defaultSourceFileGlobs = ['**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}', '!**/node_modules/**', '!**/*.d.ts'];
