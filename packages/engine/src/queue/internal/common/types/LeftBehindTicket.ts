export interface LeftBehindTicket {
	identifier: string;
	reason: string;
	title?: string;
	/** Absent, with `title`, only for a parked worktree whose ticket the tracker no longer returns. */
	url?: string;
	/** Set only on a `settled` entry whose done write failed; also folded into `reason`. */
	reconciliationFailure?: string;
	/**
	 * An already-merged ticket reconciled to Done: reported, but nothing waits on a
	 * re-run, so the exit code and coordinator status do not count it. Every other
	 * entry leaves it unset deliberately, because its worktree may hold unmerged
	 * work a person owes a look.
	 */
	settled?: boolean;
}
