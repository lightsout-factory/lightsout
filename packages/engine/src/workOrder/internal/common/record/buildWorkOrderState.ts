import type { LightsoutConfig } from '#src/contracts/LightsoutConfig/LightsoutConfig.ts';
import { WorkOrderMode } from '#src/contracts/workOrder/WorkOrderMode.ts';
import type { WorkOrderState } from '#src/contracts/workOrder/WorkOrderState.ts';

interface Params {
	/** Its folder's name under the work-orders directory. */
	name: string;
	branch: string;
	/** Absent for a work order named from words alone. */
	ticketRef?: string;
	/** Absent, the repository default applies. */
	mode?: WorkOrderMode;
	config: LightsoutConfig;
}

/**
 * The mode is seeded from the repository default here and only here: from then
 * on it is the work order's own choice, and changing the default never rewrites it.
 */
export const buildWorkOrderState = ({ name, branch, ticketRef, mode, config }: Params): WorkOrderState => ({
	schemaVersion: 1,
	name,
	branch,
	...(ticketRef === undefined ? {} : { ticketRef }),
	mode: mode ?? config.plan?.['default-work-order-mode'] ?? WorkOrderMode.SinglePlan,
	plans: [],
	history: [],
});
