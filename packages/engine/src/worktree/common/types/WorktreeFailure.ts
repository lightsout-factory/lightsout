/**
 * Declared here rather than imported from the queue: the queue depends on this
 * module, and the reverse import would be a cycle.
 */
export interface WorktreeFailure {
	/** One sentence a human can act on. Never a stack. */
	error: string;
}
