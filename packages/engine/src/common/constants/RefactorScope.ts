/**
 * The two differ in which files they may write, never in behavior: a feature's
 * refactor rides on a branch reviewed as a feature, so a reorganization
 * spreading out of it is not what that reviewer agreed to read.
 */
export const RefactorScope = {
	/** The refactor step inside an implement run: the feature's own changed files, nothing else. */
	Feature: 'feature',
	/** The `lightsout refactor` command: the standards findings are the work-list, and moving code between files is the point. */
	Standalone: 'standalone',
} as const;

export type RefactorScope = (typeof RefactorScope)[keyof typeof RefactorScope];
