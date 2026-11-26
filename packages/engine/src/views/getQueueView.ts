import { QueueBoardState } from '#src/contracts/queue/QueueBoardState.ts';
import { QueueLane } from '#src/contracts/queue/QueueLane.ts';
import { PipelineKind } from '#src/contracts/run/PipelineKind.ts';
import type { QueueView } from '#src/contracts/views/QueueView.ts';
import { readQueueBoard } from '#src/queue/board/readQueueBoard.ts';
import { readQueueSummary } from '#src/queue/board/readQueueSummary.ts';
import { toQueueBoardState } from '#src/queue/board/toQueueBoardState.ts';
import { listRuns } from '#src/views/listRuns.ts';

interface Params {
	cwd: string;
}

/**
 * The drain is the newest queue run a live process stands behind, else the
 * newest queue run of any state, so the page shows what is going before what
 * merely happened last. A drain that wrote no board has no lanes.
 */
export const getQueueView = async ({ cwd }: Params): Promise<QueueView> => {
	const queueRuns = (await listRuns({ cwd })).filter((run) => run.pipeline === PipelineKind.Queue);
	const listing = queueRuns.find((run) => run.live) ?? queueRuns[0];

	if (listing === undefined) {
		return {};
	}

	const state = toQueueBoardState({ listing });
	// Read only for a finished drain: its summary stands on its own and carries the finish time.
	const summary = state === QueueBoardState.Finished ? await readQueueSummary({ cwd, runId: listing.runId }) : undefined;
	const board = await readQueueBoard({ cwd, runId: listing.runId });
	const lanes = Object.values(QueueLane)
		.map((lane) => ({ lane, tickets: board?.tickets.filter((ticket) => ticket.lane === lane) ?? [] }))
		.filter((entry) => entry.tickets.length > 0);

	return { drain: { runId: listing.runId, state, at: summary?.finishedAt ?? board?.updatedAt ?? listing.updatedAt, lanes } };
};
