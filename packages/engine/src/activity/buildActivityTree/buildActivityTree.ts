import { nestActivityMarks } from '#src/activity/buildActivityTree/nestActivityMarks.ts';
import { gatherNodeProcesses } from '#src/activity/common/gatherNodeProcesses.ts';
import { totalActivityNode } from '#src/activity/common/totalActivityNode.ts';
import { spanOfActivityNodes } from '#src/common/spanOfActivityNodes.ts';
import type { ActivityMark } from '#src/contracts/activity/ActivityMark.ts';
import type { ActivityReport } from '#src/contracts/activity/ActivityReport.ts';

interface Params {
	/** The plan folder the record belongs to, as the caller addressed it. */
	plan: string;
	marks: ActivityMark[];
}

export const buildActivityTree = ({ plan, marks }: Params): ActivityReport => {
	const roots = nestActivityMarks({ marks });

	return { plan, roots, totals: totalActivityNode({ ...spanOfActivityNodes({ nodes: roots }), processes: gatherNodeProcesses({ nodes: roots }) }) };
};
