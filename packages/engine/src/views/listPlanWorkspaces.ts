import { readdir } from 'node:fs/promises';
import { formatPlanAddress } from '#src/common/planAddress/formatPlanAddress.ts';
import { parsePlanAddress } from '#src/common/planAddress/parsePlanAddress.ts';
import { workOrdersDir } from '#src/common/workspace/workOrdersDir.ts';
import { GradeReport } from '#src/contracts/plan/grade/GradeReport.ts';
import type { PlanWorkspaceListing } from '#src/contracts/views/planWorkspace/PlanWorkspaceListing.ts';
import { planWorkspaceDir } from '#src/plan/planWorkspaceDir.ts';
import { buildPlanWorkspaceListing } from '#src/views/common/buildPlanWorkspaceListing.ts';
import { matchPlanRuns } from '#src/views/common/matchPlanRuns.ts';
import { readPlanRecord } from '#src/views/common/readPlanRecord.ts';
import { readPlanWorkspaceFiles } from '#src/views/common/readPlanWorkspaceFiles.ts';
import { listRuns } from '#src/views/listRuns.ts';

interface Params {
	cwd: string;
}

/**
 * A ticket folder with no plans folder contributes nothing: every branch gets a
 * folder for its ship and worktree records whether or not a plan was shaped there.
 */
const namesOf = async ({ cwd, folder }: { cwd: string; folder: string }) => {
	const children = await readdir(await planWorkspaceDir({ cwd, name: folder }), { withFileTypes: true }).catch(() => undefined);

	if (children === undefined) {
		return [];
	}

	const addresses = children
		.filter((child) => child.isDirectory())
		.map((child) => formatPlanAddress({ workOrderName: folder, planId: child.name }))
		.filter((address) => parsePlanAddress({ name: address }) !== undefined);

	return addresses;
};

/**
 * Parses only `grade.json`, because the grade is a column; drawing a table is no
 * reason to open every file. A workspace whose `grade.json` will not parse is
 * listed without a grade rather than skipped: a list is an account of what is there.
 */
export const listPlanWorkspaces = async ({ cwd }: Params): Promise<PlanWorkspaceListing[]> => {
	const entries = await readdir(await workOrdersDir({ cwd }), { withFileTypes: true }).catch(() => []);
	const listings: PlanWorkspaceListing[] = [];

	for (const entry of entries.filter((candidate) => candidate.isDirectory())) {
		// Only this ticket's own runs folder, shared by its plans, so other
		// tickets' runs are never opened.
		const runs = await listRuns({ cwd, workOrderName: entry.name });

		for (const name of await namesOf({ cwd, folder: entry.name })) {
			const files = await readPlanWorkspaceFiles({ cwd, name });
			const gradeFile = files.others.get('grade.json');
			const { value } = await readPlanRecord({ cwd, file: gradeFile, schema: GradeReport });

			listings.push(buildPlanWorkspaceListing({ name, files, hasGrade: gradeFile !== undefined, grade: value?.grade, runs: matchPlanRuns({ name, runs }) }));
		}
	}

	return listings.sort((first, second) => second.updatedAt.localeCompare(first.updatedAt));
};
