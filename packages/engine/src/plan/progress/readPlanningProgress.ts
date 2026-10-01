import { readJsonFile } from '#src/common/utils/readJsonFile.ts';
import { PlanningProgress } from '#src/contracts/plan/progress/PlanningProgress.ts';
import { getPlanningProgressPath } from '#src/plan/progress/getPlanningProgressPath.ts';

interface Params {
	cwd: string;
	name: string;
}

/**
 * Never throws. Besides the status readers, the queue auto-plan worker reads it
 * after a session to find a step the session left running.
 */
export const readPlanningProgress = async ({ cwd, name }: Params): Promise<PlanningProgress | undefined> => {
	const path = await getPlanningProgressPath({ cwd, name });

	return readJsonFile({ path, schema: PlanningProgress });
};
