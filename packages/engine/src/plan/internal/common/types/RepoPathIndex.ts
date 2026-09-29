/**
 * An enumerable list rather than a search of the repo's text: a renamed file's
 * old name survives in READMEs and captured datasets, so a text search reports
 * it as real.
 */
export interface RepoPathIndex {
	/** What makes a span anchored. */
	topLevelDirs: Set<string>;
	/** EVERY file, not every source file, repo-relative. */
	files: string[];
}
