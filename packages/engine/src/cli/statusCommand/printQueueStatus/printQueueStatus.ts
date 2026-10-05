import { QueueBoardState } from '#src/cli/common/constants/QueueBoardState.ts';
import { renderQueueBoard } from '#src/cli/common/queueBoard/renderQueueBoard.ts';
import { loadActiveTicketBlock } from '#src/cli/statusCommand/printQueueStatus/loadActiveTicketBlock.ts';
import { renderTicketDetailBlock } from '#src/cli/statusCommand/printQueueStatus/renderTicketDetailBlock.ts';
import { resolveQueueRun } from '#src/cli/statusCommand/printQueueStatus/resolveQueueRun.ts';
import type { QueueBoardTicket } from '#src/contracts/queue/QueueBoardTicket.ts';
import { QueueLane } from '#src/contracts/queue/QueueLane.ts';
import { PipelineKind } from '#src/contracts/run/PipelineKind.ts';
import { RunStatus } from '#src/contracts/run/RunStatus.ts';
import type { RunListing } from '#src/contracts/views/RunListing.ts';
import { getQueueBoardPath } from '#src/queue/board/getQueueBoardPath.ts';
import { readQueueBoard } from '#src/queue/board/readQueueBoard.ts';
import { readQueueSummary } from '#src/queue/board/readQueueSummary.ts';

const toBoardState = ({ listing }: { listing: RunListing }) => {
	const going = listing.status === RunStatus.Running || listing.status === RunStatus.Pending;
	let state: QueueBoardState = QueueBoardState.Finished;

	if (going) {
		state = listing.live ? QueueBoardState.Live : QueueBoardState.Stopped;
	}

	return state;
};

const isActive = ({ ticket }: { ticket: QueueBoardTicket }) =>
	ticket.lane === QueueLane.Building || ticket.lane === QueueLane.ShippingNow || (ticket.lane === QueueLane.Blocked && ticket.question !== undefined);

const printBoard = async ({ cwd, listing }: { cwd: string; listing: RunListing }) => {
	const state = toBoardState({ listing });
	// Read before the board: a finished queue's summary stands on its own, and a
	// drain may end before any board was written.
	const summary = state === QueueBoardState.Finished ? await readQueueSummary({ cwd, runId: listing.runId }) : undefined;

	if (summary !== undefined) {
		for (const line of [...summary.boardLines, '', ...summary.reportLines]) {
			console.log(line);
		}

		return;
	}

	const board = await readQueueBoard({ cwd, runId: listing.runId });

	if (board === undefined) {
		console.log(`the queue run has no readable board yet: ${await getQueueBoardPath({ cwd, runId: listing.runId })}`);
		return;
	}

	// A live board is drawn now; a stopped or finished one shows when it was last written.
	const at = state === QueueBoardState.Live ? new Date() : new Date(board.updatedAt);
	const active =
		state === QueueBoardState.Live
			? Object.values(QueueLane).flatMap((lane) => board.tickets.filter((ticket) => ticket.lane === lane && isActive({ ticket })))
			: [];
	const lines = renderQueueBoard({ tickets: board.tickets, state, at });

	for (const ticket of active) {
		lines.push(...renderTicketDetailBlock({ ticket, lines: await loadActiveTicketBlock({ ticket }) }));
	}

	for (const line of lines) {
		console.log(line);
	}
};

interface Params {
	/** The main checkout the queue runs in. */
	cwd: string;
	/** The queue run to show, already resolved on disk; without it, the live queue run the checkout's run lock names. */
	runId?: string;
	/** Wait up to a minute for a queue run to take the lock — for a caller that has only just launched one. */
	wait?: boolean;
}

/**
 * No queue run going, or a queue run with no board yet, is a normal answer. A
 * named run that is not a queue run, or whose manifest does not read, is the
 * reader's mistake.
 */
export const printQueueStatus = async ({ cwd, runId, wait }: Params): Promise<number> => {
	const listing = await resolveQueueRun({ cwd, runId, wait });
	let code = 0;

	if (listing === undefined && runId !== undefined) {
		console.error(`run ${runId} could not be read`);
		code = 1;
	} else if (listing === undefined) {
		console.log(`no queue run is going in ${cwd}`);
	} else if (listing.pipeline !== PipelineKind.Queue) {
		console.error(`run ${listing.runId} is not a queue run — it is a ${listing.pipeline} run`);
		code = 1;
	} else {
		await printBoard({ cwd, listing });
	}

	return code;
};
