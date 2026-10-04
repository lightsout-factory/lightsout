import { loadPlanningProgressBlock } from '#src/cli/internal/common/progressBlock/loadPlanningProgressBlock.ts';
import { loadRunFamilyProgressBlock } from '#src/cli/internal/common/progressBlock/loadRunFamilyProgressBlock.ts';
import { loadShippingProgressBlock } from '#src/cli/internal/common/progressBlock/loadShippingProgressBlock.ts';
import { QueueWorker } from '#src/common/constants/QueueWorker.ts';
import { formatPlanAddress } from '#src/common/planAddress/formatPlanAddress.ts';
import type { QueueBoardTicket } from '#src/contracts/queue/QueueBoardTicket.ts';
import { QueueLane } from '#src/contracts/queue/QueueLane.ts';
import { pathExists } from '#src/plan/common/paths/pathExists.ts';
import { readShippingProgress } from '#src/ship/progress/readShippingProgress.ts';
import { listRuns } from '#src/views/listRuns.ts';
import { findNextPlanToPlan } from '#src/workOrder/findNextPlanToPlan.ts';
import { readWorkOrderState } from '#src/workOrder/readWorkOrderState.ts';

/**
 * The queue removes a shipped worktree before the lane settles the ticket, and
 * a record that started before the ticket entered Shipping Now is an earlier
 * ship's record of the same branch.
 */
const loadShippingBlock = async ({ ticket, worktreePath }: { ticket: QueueBoardTicket; worktreePath: string }) => {
	const { branch } = ticket;
	let lines: string[];

	if (branch === undefined) {
		lines = [`the board recorded no branch for ${ticket.identifier}`];
	} else if (!(await pathExists({ path: worktreePath }))) {
		lines = [`the worktree ${worktreePath} is no longer on disk`];
	} else {
		// The worktree stands in for any checkout of the repository here: the reader
		// resolves the primary itself, so this names the repository rather than the
		// directory holding the record.
		const { progress } = await readShippingProgress({ cwd: worktreePath, branch });
		const isEarlierShip = progress !== undefined && Date.parse(progress.startedAt) < Date.parse(ticket.enteredAt);

		lines = isEarlierShip
			? [`no ship step of ${branch} has been recorded since ${ticket.identifier} entered Shipping Now`]
			: await loadShippingProgressBlock({ cwd: worktreePath, branch });
	}

	return lines;
};

/**
 * Only runs created since the build began count: anything older in this folder
 * belongs to an earlier queue invocation. A run a live process stands behind
 * wins over a newer one with nothing behind it, so a stopped retry never hides
 * the build that is still moving.
 */
const findBuildRun = async ({ ticket, worktreePath, workOrderName }: { ticket: QueueBoardTicket; worktreePath: string; workOrderName: string }) => {
	const since = Date.parse(ticket.buildStartedAt ?? ticket.enteredAt);
	const candidates = (await listRuns({ cwd: worktreePath, workOrderName }))
		.filter((run) => Date.parse(run.createdAt) >= since)
		.sort((first, second) => Date.parse(second.createdAt) - Date.parse(first.createdAt));

	return candidates.find((run) => run.live) ?? candidates[0];
};

/**
 * For a ticket with a record of its own, the board's folder is the ticket
 * folder rather than a plan, so the block is read for the plan inside it still
 * being planned. A folder with no record is a plan folder itself.
 */
const loadPlanningBlock = async ({ worktreePath, workOrderName }: { worktreePath: string; workOrderName: string }) => {
	const read = await readWorkOrderState({ cwd: worktreePath, name: workOrderName });

	if ('error' in read) {
		return [read.error];
	}

	const { record } = read;

	if (record === undefined) {
		return loadPlanningProgressBlock({ cwd: worktreePath, name: workOrderName });
	}

	const waiting = findNextPlanToPlan({ record });

	return waiting === undefined
		? [`no plan in ${workOrderName} is waiting to be planned`]
		: loadPlanningProgressBlock({ cwd: worktreePath, name: formatPlanAddress({ workOrderName, planId: waiting.id }) });
};

/**
 * A board that recorded no work order gets a notice rather than a read of every
 * run in the repository, which would show whichever ticket's run is newest.
 */
const loadBuildBlock = async ({ ticket, worktreePath }: { ticket: QueueBoardTicket; worktreePath: string }) => {
	const { workOrderName } = ticket;
	const run = workOrderName === undefined ? undefined : await findBuildRun({ ticket, worktreePath, workOrderName });
	let lines: string[];

	if (workOrderName === undefined) {
		lines = [`the board recorded no work order for ${ticket.identifier}`];
	} else if (run !== undefined) {
		lines = (await loadRunFamilyProgressBlock({ cwd: worktreePath, runId: run.runId })).lines;
	} else if (ticket.worker === QueueWorker.AutoPlan) {
		lines = await loadPlanningBlock({ worktreePath, workOrderName });
	} else {
		lines = [`no engine run has started in ${worktreePath} since ${ticket.identifier}'s build began`];
	}

	return lines;
};

interface Params {
	/** A Building ticket, the Shipping Now ticket, or a ticket waiting for a relayed answer. */
	ticket: QueueBoardTicket;
}

/**
 * Exactly what the standalone `status --run`, `--planning` or `--shipping` form
 * prints for the ticket's worktree; it never draws a block of its own.
 */
export const loadActiveTicketBlock = async ({ ticket }: Params): Promise<string[]> => {
	const { worktreePath } = ticket;
	let lines: string[];

	if (worktreePath === undefined) {
		lines = [`the board recorded no worktree for ${ticket.identifier}`];
	} else if (ticket.lane === QueueLane.ShippingNow) {
		lines = await loadShippingBlock({ ticket, worktreePath });
	} else {
		lines = await loadBuildBlock({ ticket, worktreePath });
	}

	return lines;
};
