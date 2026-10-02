import { readRunOwner } from '#src/runState/owner/readRunOwner.ts';

interface Params {
	cwd: string;
	runId: string;
	queueRunId?: string;
}

/**
 * The coordinator holds no lock between phases, so a second process that
 * resumed the sequence could be driving it too; whichever the owner record no
 * longer names stops before it records an outcome over the other's.
 *
 * @param queueRunId - the queue run a worker sequence's owner record points at
 * @throws {Error} When the owner record no longer names this process.
 */
export const confirmOwnership = async ({ cwd, runId, queueRunId }: Params): Promise<void> => {
	const owner = await readRunOwner({ cwd, runId });

	if (owner !== undefined && ('queueRunId' in owner ? owner.queueRunId === queueRunId : owner.pid === process.pid)) {
		return;
	}

	let holder = 'has no owner record now';

	if (owner !== undefined) {
		holder = 'queueRunId' in owner ? `is now owned by queue run ${owner.queueRunId}` : `is now owned by pid ${owner.pid}`;
	}

	throw new Error(`run ${runId} ${holder} — this process stops without recording the phase`);
};
