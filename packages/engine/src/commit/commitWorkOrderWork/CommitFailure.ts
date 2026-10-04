/** A step that can fail returns `T | CommitFailure` rather than throwing across a seam. */
export interface CommitFailure {
	/** One sentence a human can act on. Never a stack. */
	error: string;
}
