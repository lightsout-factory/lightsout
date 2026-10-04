import { rm } from 'node:fs/promises';
import { readProcessStartTime } from '#src/common/processes/readProcessStartTime.ts';
import { writeJsonFile } from '#src/common/utils/writeJsonFile.ts';
import type { RunOwner } from '#src/contracts/run/RunOwner.ts';
import { getRunFinalReportPath } from '#src/runState/finalReport/getRunFinalReportPath.ts';
import { getRunOwnerPath } from '#src/runState/owner/common/getRunOwnerPath.ts';

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
 * when handed a queue run id. Written atomically: other processes read
 * the record while a resume replaces it, and a torn read would look like no
 * owner at all.
 *
 * Only root runs get an owner, and every new attempt writes one, so the run's
 * saved final report goes first: a saved report is only ever the one from the
 * attempt that last ended the run.
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

	await rm(await getRunFinalReportPath({ cwd, runId }), { force: true });

	await writeJsonFile({ path: await getRunOwnerPath({ cwd, runId }), value: owner, atomic: true });

	return owner;
};
