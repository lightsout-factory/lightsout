import { readdir } from 'node:fs/promises';
import { workOrdersDir } from '#src/common/workspace/workOrdersDir.ts';
import type { WorkOrderView } from '#src/contracts/views/workOrder/WorkOrderView.ts';
import { buildShippingStepRows } from '#src/ship/progress/buildShippingStepRows.ts';
import { readWorkOrderSummary } from '#src/views/common/readWorkOrderSummary.ts';
import { isPlanlessWorkOrder } from '#src/workOrder/isPlanlessWorkOrder.ts';
import { readWorkOrderState } from '#src/workOrder/readWorkOrderState.ts';

/**
 * The traversal guard is membership: only the name of a folder the work-orders
 * directory lists is ever opened, so no `..`, separator or empty name can reach
 * anything outside it.
 */
const holdsWorkOrder = async ({ cwd, name }: { cwd: string; name: string }) => {
	const entries = await readdir(await workOrdersDir({ cwd }), { withFileTypes: true }).catch(() => []);

	return entries.some((entry) => entry.isDirectory() && entry.name === name);
};

interface Params {
	cwd: string;
	/** The folder's name under the work-orders directory. */
	name: string;
}

/**
 * @returns The view, or `undefined` when no work-order folder has that name or the folder holds no record.
 * @throws {Error} When the work order's record is on disk and will not parse; the message is the reader's reason.
 */
export const getWorkOrderView = async ({ cwd, name }: Params): Promise<WorkOrderView | undefined> => {
	if (!(await holdsWorkOrder({ cwd, name }))) {
		return undefined;
	}

	const read = await readWorkOrderState({ cwd, name });

	if ('error' in read) {
		throw new Error(read.error);
	}

	const { record } = read;

	if (record === undefined) {
		return undefined;
	}

	const { summary, shipResult, shipProgress, shipLive } = await readWorkOrderSummary({ cwd, name, record });
	// The shared step-row rule decides every status and duration; the view only narrows each row to its contract.
	const shipRows = shipProgress === undefined ? [] : buildShippingStepRows({ progress: shipProgress, live: shipLive, nowMs: Date.now() });
	const body = record.ticketBodyBuild;

	return {
		summary,
		mode: record.mode,
		plans: record.plans.map((plan) => ({
			id: plan.id,
			title: plan.title,
			progress: plan.progress,
			exclusion: plan.exclusion === undefined ? undefined : { at: plan.exclusion.at, reason: plan.exclusion.reason },
		})),
		builtFromTicketBody: isPlanlessWorkOrder({ record }),
		ticketBodyBuild: body === undefined ? undefined : { progress: body.progress, startedAt: body.startedAt, finishedAt: body.finishedAt },
		shipResult,
		shipSteps: shipRows.map(({ id, status, durationMs }) => ({ id, status, durationMs })),
		shipLive,
		history: record.history.map(({ at, kind, detail }) => ({ at, kind, detail })),
	};
};
