import type { RunListing } from '#src/contracts/views/RunListing.ts';

interface Params {
	name: string;
	runs: RunListing[];
}

/**
 * Equality against the name a run declared rather than a guess from its plan
 * path, so a plan folder renamed after the run started still answers.
 * `listRuns` already returns newest first, so the order is kept.
 */
export const matchPlanRuns = ({ name, runs }: Params): RunListing[] => runs.filter((run) => run.planName === name);
