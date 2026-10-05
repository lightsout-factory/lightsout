import type { WorkOrderListing } from '#src/common/types/WorkOrderListing.ts';
import { listWorkOrders } from '#src/workOrder/common/listWorkOrders.ts';

interface Params {
	/** Any checkout of the repository: the records this machine holds are found from it. */
	cwd: string;
	/** The ticket reference to look for, in whatever case the caller has it. */
	ticketRef: string;
}

/**
 * The comparison ignores case: a tracker writes `LO-158` and a branch template writes `lo-158`.
 * The first match wins if two records carry one reference; `createWorkOrder`, the one writer,
 * asks this before composing anything, so that state does not arise.
 */
export const findWorkOrderByTicketRef = async ({ cwd, ticketRef }: Params): Promise<WorkOrderListing | undefined> => {
	const { found } = await listWorkOrders({ cwd });
	const wanted = ticketRef.toLowerCase();

	return found.find((entry) => entry.record.ticketRef?.toLowerCase() === wanted);
};
