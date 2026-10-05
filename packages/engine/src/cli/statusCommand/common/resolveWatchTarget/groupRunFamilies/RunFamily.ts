import type { RunListing } from '#src/contracts/views/RunListing.ts';

/** A phased plan's coordinator and the phase children it started, treated as one choice. */
export interface RunFamily {
	/** The coordinator's run id, or the run's own id when it has no coordinator. */
	root: string;
	/** Newest updated first. */
	runs: RunListing[];
}
