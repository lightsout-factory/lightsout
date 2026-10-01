import { rename } from 'node:fs/promises';
import { readProcessStartTime } from '#src/common/processes/readProcessStartTime.ts';
import { writeJsonFile } from '#src/common/utils/writeJsonFile.ts';
import type { RunOwner } from '#src/contracts/run/RunOwner.ts';
import { getRunOwnerPath } from '#src/runState/owner/getRunOwnerPath.ts';

interface Params {
	cwd: string;
	runId: string;
	/** The queue run this run is a worker of; the record then points there rather than at this process. */
	queueRunId?: string;
}

// A process's start time never changes, and every root run records it, so `ps`
// runs once per process rather than once per run.
let ownStartTime: Promise<string | undefined> | undefined;

/**
 * Replaces the run's owner record with this process, or with the pointer form
 * when handed a queue run id. Atomic (tmp file + rename): other processes read
 * the record while a resume replaces it, and a torn read would look like no
 * owner at all.
 */
export const writeRunOwner = async ({ cwd, runId, queueRunId }: Params): Promise<RunOwner> => {
	let owner: RunOwner;

	if (queueRunId === undefined) {
		ownStartTime ??= readProcessStartTime({ pid: process.pid });
		const processStartTime = await ownStartTime;

		owner = {
			pid: process.pid,
			...(processStartTime === undefined ? {} : { processStartTime }),
			recordedAt: new Date().toISOString(),
		};
	} else {
		owner = { queueRunId };
	}

	const ownerPath = await getRunOwnerPath({ cwd, runId });
	const tmpPath = `${ownerPath}.tmp`;

	await writeJsonFile({ path: tmpPath, value: owner });
	await rename(tmpPath, ownerPath);

	return owner;
};
