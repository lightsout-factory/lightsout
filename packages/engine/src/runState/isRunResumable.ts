import { RunStatus } from '#src/contracts/run/RunStatus.ts';

interface Params {
	status: RunStatus;
	/** Whether a live process stands behind the run — see isRunLive. */
	live: boolean;
}

/**
 * The single definition every consumer reads, so a listing row and a detail
 * header never disagree. A `running` run with nothing behind it is a crash
 * leftover and resumable; `escalated` waits on a human decision, not a resume.
 */
export const isRunResumable = ({ status, live }: Params): boolean => {
	if (status === RunStatus.Running) {
		return !live;
	}

	return status === RunStatus.Failed || status === RunStatus.PausedRateLimit || status === RunStatus.PausedBudget;
};
