import { readProcessStartTime } from '#src/common/processes/readProcessStartTime.ts';
import { isPidAlive } from '#src/runState/isPidAlive.ts';

interface Params {
	pid: number;
	/** The start time recorded beside the pid; absent when it could not be read then. */
	processStartTime?: string;
}

/**
 * A live pid may be a newcomer that reused a dead process's number, so the
 * recorded start time must match the live one. When either side is unknown the
 * pid alone decides.
 */
export const isRecordedProcessAlive = async ({ pid, processStartTime }: Params): Promise<boolean> => {
	if (!isPidAlive({ pid })) {
		return false;
	}

	const liveStartTime = processStartTime === undefined ? undefined : await readProcessStartTime({ pid });

	return liveStartTime === undefined || liveStartTime === processStartTime;
};
