import { gatherNodeProcesses } from '#src/activity/common/gatherNodeProcesses.ts';
import { totalActivityNode } from '#src/activity/common/totalActivityNode.ts';
import { spanOfActivityNodes } from '#src/common/spanOfActivityNodes.ts';
import type { ActivityReport } from '#src/contracts/activity/ActivityReport.ts';
import type { ActivityTotals } from '#src/contracts/activity/ActivityTotals.ts';

interface Params {
	/** One fold per plan, each already built by `buildActivityTree`. */
	reports: ActivityReport[];
}

/**
 * Busy time is a union of intervals and peak concurrency spans the whole
 * ticket, so neither can be summed from per-plan totals; every process is
 * re-totalled together instead.
 */
export const totalActivityReports = ({ reports }: Params): ActivityTotals => {
	const roots = reports.flatMap((report) => report.roots);

	return totalActivityNode({ ...spanOfActivityNodes({ nodes: roots }), processes: gatherNodeProcesses({ nodes: roots }) });
};
