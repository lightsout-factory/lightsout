import { z } from 'zod';
import { WorkOrderStatus } from '#src/contracts/views/workOrder/WorkOrderStatus.ts';

/** One row of the work orders list, derived from what the engine has recorded and nothing else. */
export const WorkOrderSummary = z.object({
	/** The folder's name under the work-orders directory. */
	name: z.string(),
	/** The ticket the work belongs to, as the tracker names it; absent for a work order named from words alone. */
	ticketRef: z.string().optional(),
	/** The git branch the work order's plans implement on. */
	branch: z.string(),
	status: z.enum(WorkOrderStatus),
	/** Counted plans whose progress is implemented. */
	plansDone: z.number(),
	/** Plans carrying no exclusion. */
	plansTotal: z.number(),
	/** Present only when the last ship result is shipped. */
	prUrl: z.string().optional(),
	/** The newest ISO timestamp recorded in the work order's files, never a file's modification time. */
	updatedAt: z.string(),
	/** A ship, a planning step or a run process stands behind the work order right now. */
	live: z.boolean(),
});

export type WorkOrderSummary = z.infer<typeof WorkOrderSummary>;
