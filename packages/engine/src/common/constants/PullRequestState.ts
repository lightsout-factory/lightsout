/** The pull-request states the forge readers ask `gh` for, spelled as `gh pr list --state` takes them. */
export const PullRequestState = {
	Open: 'open',
	Merged: 'merged',
} as const;

export type PullRequestState = (typeof PullRequestState)[keyof typeof PullRequestState];
