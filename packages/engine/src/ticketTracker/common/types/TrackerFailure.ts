/**
 * Every operation returns `T | TrackerFailure` rather than throwing across the
 * seam. It mirrors `QueueFailure` rather than importing it, since this module
 * cannot import the queue's types.
 */
export interface TrackerFailure {
	/** One sentence a human can act on. Never a stack. */
	error: string;
}
