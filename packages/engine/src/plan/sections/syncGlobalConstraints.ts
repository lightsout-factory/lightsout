import type { DecisionsRecord } from '#src/contracts/plan/decisions/DecisionsRecord.ts';
import type { SyncedPlanFile } from '#src/plan/common/types/SyncedPlanFile.ts';
import { generatedPlanRegions } from '#src/plan/internal/common/constants/generatedPlanRegions.ts';
import { renderGlobalConstraints } from '#src/plan/sections/renderGlobalConstraints.ts';
import { writePlanSection } from '#src/plan/sections/writePlanSection.ts';

interface Params {
	/** Absolute; every file of the deliverable. */
	planPaths: string[];
	/** The merged record the constraints are selected from. */
	decisions: DecisionsRecord;
}

/**
 * Unlike the Decision Log, every file gets the full section: a phase file is
 * handed to an implementing agent on its own, and would otherwise be read
 * without the rules binding it.
 */
export const syncGlobalConstraints = async ({ planPaths, decisions }: Params): Promise<SyncedPlanFile[]> => {
	const section = renderGlobalConstraints({ decisions: decisions.decisions });
	const files: SyncedPlanFile[] = [];

	for (const path of planPaths) {
		files.push(
			await writePlanSection({
				path,
				heading: generatedPlanRegions.globalConstraints,
				section,
				after: generatedPlanRegions.decisionLog,
			}),
		);
	}

	return files;
};
