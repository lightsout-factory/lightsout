import type { DecisionsRecord } from '#src/contracts/plan/decisions/DecisionsRecord.ts';
import type { SyncedPlanFile } from '#src/plan/common/types/SyncedPlanFile.ts';
import { syncPlanDecisions } from '#src/plan/decisionLog/syncPlanDecisions.ts';
import { syncGlobalConstraints } from '#src/plan/sections/syncGlobalConstraints.ts';
import { syncPhaseSectionsFromFiles } from '#src/plan/sections/syncPhaseSectionsFromFiles.ts';

interface Params {
	cwd: string;
	/** Kebab plan name — what `syncPlanDecisions` resolves the workspace by. */
	name: string;
	/** Absolute paths of every plan file of this deliverable, the overview included. */
	planPaths: string[];
	/** The merged record the draft was started from. */
	decisions: DecisionsRecord;
	/** Absolute path of the overview when the deliverable is phased; absent for a standalone plan. */
	overviewPath?: string;
}

/**
 * Spawns nothing: each section here is settled by a record the engine already
 * holds, so an agent attempt spent on it is an attempt not spent on the plan.
 */
export const repairMechanicalFindings = async ({ cwd, name, planPaths, decisions, overviewPath }: Params): Promise<SyncedPlanFile[]> => {
	const synced = await syncPlanDecisions({ cwd, name, planPaths, decisions });
	const files: SyncedPlanFile[] = [...('files' in synced ? synced.files : []), ...(await syncGlobalConstraints({ planPaths, decisions }))];

	if (overviewPath !== undefined) {
		const phasePaths = planPaths.filter((path) => path !== overviewPath);

		files.push(await syncPhaseSectionsFromFiles({ overviewPath, phasePaths }));
	}

	return files;
};
