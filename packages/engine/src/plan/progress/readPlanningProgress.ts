import { readJsonFile } from '#src/common/utils/readJsonFile.ts';
import { PlanningProgress } from '#src/contracts/plan/progress/PlanningProgress.ts';
import { getPlanningProgressPath } from '#src/plan/progress/getPlanningProgressPath.ts';

interface Params {
	cwd: string;
	name: string;
}

/** Never throws: the record is a reader's convenience. */
export const readPlanningProgress = async ({ cwd, name }: Params): Promise<PlanningProgress | undefined> => {
	const path = await getPlanningProgressPath({ cwd, name });

	return readJsonFile({ path, schema: PlanningProgress });
};
