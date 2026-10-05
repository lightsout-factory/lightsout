import { randomUUID } from 'node:crypto';
import { acquireRunLock } from '#src/runState/lock/withRunLock/acquireRunLock.ts';
import { releaseRunLock } from '#src/runState/lock/withRunLock/releaseRunLock.ts';

interface PipelineParams {
	cwd: string;
	/** Resume: reuse this run's id instead of minting one. */
	existing?: { runId: string };
	/** A fresh run's pre-minted id, so a caller can name the run before it starts. Ignored when resuming. */
	runId?: string;
	onProgress?: (message: string) => void;
}

interface Params<Input extends PipelineParams, Result> {
	params: Input;
	/** The pipeline body, entered holding the lock with the run id threaded in. */
	run: (params: Input & { runId: string }) => Promise<Result>;
}

/**
 * The lock is taken before any disk write, so a conflicting start throws
 * RunLockError with nothing else done. The lock guards the process, not the
 * run; resume re-acquires.
 */
export const withRunLock = async <Input extends PipelineParams, Result>({ params, run }: Params<Input, Result>): Promise<Result> => {
	const runId = params.existing?.runId ?? params.runId ?? randomUUID();
	const lock = await acquireRunLock({ cwd: params.cwd, runId });

	if (lock.stalePid !== undefined) {
		params.onProgress?.(`stale run lock from dead pid ${lock.stalePid} — taking over`);
	}

	try {
		return await run({ ...params, runId });
	} finally {
		await releaseRunLock({ cwd: params.cwd, runId });
	}
};
