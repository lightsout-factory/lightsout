import type { RunLock } from '#src/contracts/run/RunLock.ts';
import { isPidAlive } from '#src/runState/liveness/isPidAlive.ts';
import { readRunLock } from '#src/runState/lock/readRunLock.ts';

interface Params {
	/** The checkout whose `.lightsout/lock.json` is read — a worktree path, not the launching checkout. */
	cwd: string;
}

/**
 * The ownership record outlives the run that cut a tree, so only a live lock
 * says a run is still editing it. A lock whose process is gone is a crash
 * leftover, or one crashed run would fence its ticket's tree off for good.
 */
export const readLiveRunLock = async ({ cwd }: Params): Promise<RunLock | undefined> => {
	const lock = await readRunLock({ cwd });

	return lock !== undefined && isPidAlive({ pid: lock.pid }) ? lock : undefined;
};
