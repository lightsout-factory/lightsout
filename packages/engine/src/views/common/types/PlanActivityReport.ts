import type { ActivityReport } from '#src/contracts/activity/ActivityReport.ts';

export interface PlanActivityReport {
	/** The plan this covers — a plan address. */
	name: string;
	/** The totalled tree, or undefined when that plan folder holds no activity record. */
	report: ActivityReport | undefined;
}
