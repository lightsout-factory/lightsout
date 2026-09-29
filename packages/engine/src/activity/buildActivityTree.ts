import { spanOfActivityNodes } from '#src/activity/common/utils/spanOfActivityNodes.ts';
import { gatherNodeProcesses } from '#src/activity/internal/common/utils/gatherNodeProcesses.ts';
import { nestActivityMarks } from '#src/activity/internal/common/utils/nestActivityMarks.ts';
import { totalActivityNode } from '#src/activity/internal/common/utils/totalActivityNode.ts';
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
