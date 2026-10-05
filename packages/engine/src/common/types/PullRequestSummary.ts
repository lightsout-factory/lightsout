export interface PullRequestSummary {
	number: number;
	url: string;
	title: string;
	/** Head branch as the forge records it. */
	branch: string;
}
