/** The repo's own answer to which files are code and which of those are tests, read once from its config. */
export interface RepoFileGlobs {
	/** The `source-files` globs: every code file, its tests included. */
	source: string[];
	/** The `test-files` globs. */
	tests: string[];
}
