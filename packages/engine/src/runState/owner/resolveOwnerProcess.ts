import type { RunOwner } from '#src/contracts/run/RunOwner.ts';
import { readRunOwner } from '#src/runState/owner/readRunOwner.ts';
import { RunNotFoundError } from '#src/runState/RunNotFoundError.ts';

interface Params {
	cwd: string;
	owner: RunOwner;
}

/**
 * The process record answering for a run. A queue worker's record points at the
 * queue run, whose own record names the process; only a process form there can
 * answer, so a missing queue run, a missing record or a second pointer leaves
 * the worker with nobody behind it.
 */
export const resolveOwnerProcess = async ({ cwd, owner }: Params): Promise<Extract<RunOwner, { pid: number }> | undefined> => {
	if ('pid' in owner) {
		return owner;
	}

	const queueOwner = await readRunOwner({ cwd, runId: owner.queueRunId }).catch((error: unknown) => {
		if (error instanceof RunNotFoundError) {
			return undefined;
		}

		throw error;
	});

	return queueOwner !== undefined && 'pid' in queueOwner ? queueOwner : undefined;
};
