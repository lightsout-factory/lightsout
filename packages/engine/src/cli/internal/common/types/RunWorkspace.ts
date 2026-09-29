/**
 * A run continuing in a planning session's tree is isolated but not created.
 * Removal is gated on the worktree ownership record, never on this type.
 */
export interface RunWorkspace {
	cwd: string;
	/** Absent when isolation is off, where the run builds whatever branch the checkout already holds. */
	branch?: string;
	/** True when the run works in a worktree rather than the launching checkout. */
	isolated: boolean;
	/** True when THIS run created the worktree. Read together with the worktree ownership record when a later confirmed merge decides whether the tree may be removed. */
	created: boolean;
}
