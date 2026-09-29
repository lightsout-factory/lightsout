import type { PullRequestSummary } from '#src/ship/forge/common/types/PullRequestSummary.ts';

export interface MergeEvidence {
	/**
	 * Present only when the forge established the merge, in which case the record
	 * is already written; absent means the queue's own record answered.
	 */
	pullRequest?: PullRequestSummary;
}
