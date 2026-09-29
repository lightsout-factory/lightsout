import { RunStatus } from '#src/contracts/run/RunStatus.ts';

interface Params {
	status: RunStatus;
}

/**
 * A `--max-batches` ceiling and a harness rate-limit wall both end a run with
 * work still to do, and neither is a fault. The single definition, because a
 * paused run is reported differently everywhere it surfaces: guidance on
 * stdout rather than a failure on stderr, and its own exit code.
 */
export const isRunPaused = ({ status }: Params): boolean => status === RunStatus.PausedRateLimit || status === RunStatus.PausedBudget;
