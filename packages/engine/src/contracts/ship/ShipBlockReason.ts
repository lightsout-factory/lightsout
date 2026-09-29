/** Why a ship attempt stopped, once its own recovery is spent. Re-running `lightsout ship` resumes. */
export const ShipBlockReason = {
	DirtyTree: 'dirty-tree',
	/** The checkout is on the repository's default branch, or the remote's default branch could not be named. */
	DefaultBranch: 'default-branch',
	TicketPatternMismatch: 'ticket-pattern-mismatch',
	/** The configured `pre-ship` command exited non-zero, or its changes could not be committed. */
	PreShipFailed: 'pre-ship-failed',
	PushFailed: 'push-failed',
	/** `gh` is missing, or is not authenticated for this repository's host. */
	ForgeNotAuthenticated: 'forge-not-authenticated',
	/** Not inside a git worktree, on a detached HEAD, or git could not answer within its deadline. */
	GitUnreadable: 'git-unreadable',
	PullRequestUnavailable: 'pull-request-unavailable',
	ChecksFailed: 'checks-failed',
	ChecksTimedOut: 'checks-timed-out',
	MergeRejected: 'merge-rejected',
	/** Git could not fetch `origin`, could not start the merge, or could not say what commit the branch was on. */
	IntegrationUnavailable: 'integration-unavailable',
	/** Merging the remote default branch left conflicts that the bounded recovery did not settle. */
	IntegrationConflict: 'integration-conflict',
	/** The integrated branch did not pass the repository's own gates within the repair allowance. */
	IntegrationGatesFailed: 'integration-gates-failed',
	/** Another gate run held the machine past the wait, so no gate ran. A ticket-backed ship holds on this reason. */
	IntegrationGatesUnavailable: 'integration-gates-unavailable',
	/** A gate on the integrated branch crashed on every attempt; no repair was spent. */
	IntegrationGatesCrashed: 'integration-gates-crashed',
	/** A gate on the integrated branch ran past its ceiling on every attempt; no repair was spent. */
	IntegrationGatesTimedOut: 'integration-gates-timed-out',
	/** No CI checks appeared for the pushed commit before the wait ceiling, and the repository has not explicitly opted out. */
	ChecksMissing: 'checks-missing',
	/** The work order does not authorize shipping. Checked before the push and again before the merge. */
	WorkOrderNotAuthorized: 'ticket-not-authorized',
} as const;

export type ShipBlockReason = (typeof ShipBlockReason)[keyof typeof ShipBlockReason];
