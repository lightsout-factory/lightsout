export interface TestTargetGroup {
	/** Repo-relative changed files that must execute under the group's tests. */
	files: string[];
	/**
	 * The group's files plus every file that imports one directly with runtime
	 * code of its own. Two writers never hold one file at once: they could edit
	 * the same test on disk.
	 */
	held: string[];
}
