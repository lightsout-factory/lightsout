export interface TestTargetGroup {
	/** Repo-relative changed files that must execute under the group's tests. No other group holds any of them. */
	files: string[];
}
