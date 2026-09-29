import type { RunListing } from '#src/contracts/views/RunListing.ts';

interface Params {
	run: RunListing;
}

export const getRunFamilyRoot = ({ run }: Params): string => run.parentRunId ?? run.runId;
