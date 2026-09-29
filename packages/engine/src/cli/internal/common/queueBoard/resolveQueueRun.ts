import { setTimeout as delay } from 'node:timers/promises';
import { PipelineKind } from '#src/contracts/run/PipelineKind.ts';
import type { RunListing } from '#src/contracts/views/RunListing.ts';
import { isPidAlive } from '#src/runState/isPidAlive.ts';
import { readRunLock } from '#src/runState/lock/readRunLock.ts';
import { listRuns } from '#src/views/listRuns.ts';

const findLockedQueueRun = async ({ cwd }: { cwd: string }) => {
	const lock = await readRunLock({ cwd });
	const holder = lock !== undefined && isPidAlive({ pid: lock.pid }) ? lock.runId : undefined;

	return holder === undefined ? undefined : (await listRuns({ cwd })).find((run) => run.runId === holder && run.pipeline === PipelineKind.Queue);
};

const findNamedRun = async ({ cwd, runId }: { cwd: string; runId: string }) => (await listRuns({ cwd })).find((run) => run.runId === runId);

interface Params {
	/** The main checkout the queue runs in. */
	cwd: string;
	/** A run id already resolved on disk. */
	runId?: string;
	/** Spend the grace period waiting for a queue run to take the lock; without it the first look is the answer. */
	wait?: boolean;
	/** How long to wait for a queue run to take the lock before giving up. */
	graceMs?: number;
	pollMs?: number;
}

/**
 * Unnamed, it is only the queue run the run lock names; it never falls back to
 * the newest queue run, which would show a previous invocation's board.
 *
 * The grace period is opt-in: only the queue skill's launch snapshot needs it,
 * because it asks before the queue it just started has taken the lock.
 */
export const resolveQueueRun = async ({ cwd, runId, wait = false, graceMs = 60_000, pollMs = 2_000 }: Params): Promise<RunListing | undefined> => {
	const find = () => (runId === undefined ? findLockedQueueRun({ cwd }) : findNamedRun({ cwd, runId }));
	const deadline = Date.now() + (runId === undefined && wait ? graceMs : 0);
	let listing = await find();

	while (listing === undefined && Date.now() < deadline) {
		await delay(pollMs);
		listing = await find();
	}

	return listing;
};
