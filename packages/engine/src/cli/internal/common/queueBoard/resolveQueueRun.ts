import { setTimeout as delay } from 'node:timers/promises';
import { PipelineKind } from '#src/contracts/run/PipelineKind.ts';
import type { RunListing } from '#src/contracts/views/RunListing.ts';
import { listRuns } from '#src/views/listRuns.ts';

// `listRuns` answers newest updated first, so the first live queue run is the newest one.
const findLiveQueueRun = async ({ cwd }: { cwd: string }) => (await listRuns({ cwd })).find((run) => run.pipeline === PipelineKind.Queue && run.live);

const findNamedRun = async ({ cwd, runId }: { cwd: string; runId: string }) => (await listRuns({ cwd })).find((run) => run.runId === runId);

interface Params {
	/** The main checkout the queue runs in. */
	cwd: string;
	/** A run id already resolved on disk. */
	runId?: string;
	/** Spend the grace period waiting for a queue run to start; without it the first look is the answer. */
	wait?: boolean;
	/** How long to wait for a queue run to start before giving up. */
	graceMs?: number;
	pollMs?: number;
}

/**
 * Unnamed, it is only a queue run a live process stands behind; it never falls
 * back to a queue run with nothing behind it, which would show a previous
 * invocation's board.
 *
 * The grace period is opt-in: only the queue skill's launch snapshot needs it,
 * because it asks before the queue it just started has recorded itself.
 */
export const resolveQueueRun = async ({ cwd, runId, wait = false, graceMs = 60_000, pollMs = 2_000 }: Params): Promise<RunListing | undefined> => {
	const find = () => (runId === undefined ? findLiveQueueRun({ cwd }) : findNamedRun({ cwd, runId }));
	const deadline = Date.now() + (runId === undefined && wait ? graceMs : 0);
	let listing = await find();

	while (listing === undefined && Date.now() < deadline) {
		await delay(pollMs);
		listing = await find();
	}

	return listing;
};
