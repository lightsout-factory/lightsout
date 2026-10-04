import type { RunManifest } from '#src/contracts/run/RunManifest.ts';
import { isRecordedProcessAlive } from '#src/runState/liveness/isRecordedProcessAlive.ts';
import { readRunOwner } from '#src/runState/owner/readRunOwner.ts';
import { resolveOwnerProcess } from '#src/runState/owner/resolveOwnerProcess.ts';

interface Params {
	cwd: string;
	manifest: RunManifest;
}

/**
 * A second process must never take over a run whose owner still lives. Judged
 * whatever the manifest says, because a passed direct run's first process may
 * still be committing or shipping outside the lock. A queue worker's record
 * points at the queue, and stop refuses a worker run, so the queue run is the
 * one named. A run with no owner record refuses nothing: the run lock guards it.
 *
 * @returns true when a live owner was found and reported, so the caller has only to exit
 */
export const reportLiveOwner = async ({ cwd, manifest }: Params): Promise<boolean> => {
	const owner = await readRunOwner({ cwd, runId: manifest.runId });
	const queueRunId = owner !== undefined && 'queueRunId' in owner ? owner.queueRunId : undefined;
	const recorded = owner === undefined ? undefined : await resolveOwnerProcess({ cwd, owner });

	if (recorded === undefined || !(await isRecordedProcessAlive(recorded))) {
		return false;
	}

	console.error(
		queueRunId === undefined
			? `run ${manifest.runId} is still running under process ${recorded.pid} — stop it first with: lightsout stop --run ${manifest.runId}`
			: `run ${manifest.runId} is a worker of queue run ${queueRunId}, still running under process ${recorded.pid} — stop the queue first with: lightsout stop --run ${queueRunId}`,
	);

	return true;
};
