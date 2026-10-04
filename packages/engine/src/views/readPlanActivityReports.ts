import { buildActivityTree } from '#src/activity/buildActivityTree/buildActivityTree.ts';
import { readActivityMarks } from '#src/activity/readActivityMarks.ts';
import { planWorkspaceDir } from '#src/plan/planWorkspaceDir.ts';
import type { PlanActivityReport } from '#src/views/common/types/PlanActivityReport.ts';

interface Params {
	cwd: string;
	/** Plan addresses already resolved. */
	names: string[];
}

/**
 * A plan folder holding no activity record answers an absent `report` rather than
 * failing the read for the plan beside it. A partly written record still builds
 * a tree from the marks that parsed, because a record cut off when its process
 * was killed proves everything above the cut.
 */
export const readPlanActivityReports = async ({ cwd, names }: Params): Promise<PlanActivityReport[]> => {
	const reports: PlanActivityReport[] = [];

	for (const name of names) {
		const marks = await readActivityMarks({ dir: await planWorkspaceDir({ cwd, name }) });

		reports.push({ name, report: marks.length === 0 ? undefined : buildActivityTree({ plan: name, marks }) });
	}

	return reports;
};
