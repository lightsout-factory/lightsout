import { rm } from 'node:fs/promises';
import { getRunOwnerPath } from '#src/runState/owner/common/getRunOwnerPath.ts';
import { RunNotFoundError } from '#src/runState/RunNotFoundError.ts';

interface Params {
	cwd: string;
	runId: string;
}

/**
 * A settled queue worker run must stop pointing at the queue, which is still
 * alive, or it would read live after its build ended. Quiet when there is no
 * record, or no run, to remove.
 */
export const removeRunOwner = async ({ cwd, runId }: Params): Promise<void> => {
	const ownerPath = await getRunOwnerPath({ cwd, runId }).catch((error: unknown) => {
		if (error instanceof RunNotFoundError) {
			return undefined;
		}

		throw error;
	});

	if (ownerPath === undefined) {
		return;
	}

	await rm(ownerPath, { force: true });
};
