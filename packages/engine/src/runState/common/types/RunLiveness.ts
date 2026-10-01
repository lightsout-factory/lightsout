export interface RunLiveness {
	live: boolean;
	/** The process answering for the run while it is live — the owner's pid (the queue's owner for a queue worker's run), or the lock holder's pid for a run whose root recorded no owner. Undefined when the run is not live. */
	pid: number | undefined;
}
