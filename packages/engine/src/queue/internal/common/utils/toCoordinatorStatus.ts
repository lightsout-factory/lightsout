import { RunStatus } from '#src/contracts/run/RunStatus.ts';
import type { QueueDrainReport } from '#src/queue/common/types/QueueDrainReport.ts';
import { isParkedOutcome } from '#src/queue/common/utils/isParkedOutcome.ts';

interface Params {
	drained: QueueDrainReport;
}

/**
 * A reconciled already-merged ticket is settled and never re-offered, and a
 * ticket the queue left open waits on a human, so neither counts as work left.
 */
export const toCoordinatorStatus = ({ drained }: Params): RunStatus => {
	const unfinished = drained.leftBehind.filter((entry) => entry.settled !== true);
	const parked = drained.outcomes.filter((outcome) => isParkedOutcome({ outcome }));

	return parked.length === 0 && unfinished.length === 0 ? RunStatus.Passed : RunStatus.Escalated;
};
