import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { BuildMode } from '#src/common/constants/BuildMode.ts';
import type { DecisionsRecord } from '#src/contracts/plan/decisions/DecisionsRecord.ts';
import type { PhaseDeclaration } from '#src/plan/common/types/PhaseDeclaration.ts';
import type { SyncedPlanFile } from '#src/plan/common/types/SyncedPlanFile.ts';
import { syncPlanDecisions } from '#src/plan/decisionLog/syncPlanDecisions.ts';
import { stampPhaseCounts } from '#src/plan/draft/stampPhaseCounts.ts';
import { parsePlan } from '#src/plan/parsePlan.ts';
import { syncGlobalConstraints } from '#src/plan/sections/syncGlobalConstraints.ts';
import { syncPhaseSections } from '#src/plan/sections/syncPhaseSections.ts';

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
 * The phase file's budget and build mode win because that is the file the
 * implementing agent is handed. `stampPhaseCounts` deliberately does not stamp
 * these: the check it serves has to be able to see the two copies disagree.
 *
 * A standard phase file drops the `buildMode` key outright rather than setting
 * it to standard, so the rendered block carries no mode bullet at all; a block
 * that said yes to both bullets loses its conflict to the phase file's own mode.
 */
const withOwnDeclarations = async ({ declarations, phasePaths }: { declarations: PhaseDeclaration[]; phasePaths: string[] }) => {
	const owned = new Map<string, { fileBudget?: number; buildMode: BuildMode }>();

	for (const phasePath of phasePaths) {
		const base = basename(phasePath);
		const plan = parsePlan({ content: await readFile(phasePath, 'utf8'), base });

		owned.set(base, { fileBudget: plan.fileBudget, buildMode: plan.buildMode });
	}

	return declarations.map((declaration) => {
		const own = owned.get(declaration.file);

		if (own === undefined) {
			return declaration;
		}

		const { buildMode: _buildMode, buildModeConflict: _buildModeConflict, ...rest } = declaration;

		return { ...rest, fileBudget: own.fileBudget, ...(own.buildMode === BuildMode.Standard ? {} : { buildMode: own.buildMode }) };
	});
};

/**
 * Spawns nothing: each section here is settled by a record the engine already
 * holds, so an agent attempt spent on it is an attempt not spent on the plan.
 *
 * The stamp has to run before the phase sections are rendered, or the overview
 * agent's estimated counts are written back over the real ones.
 */
export const repairMechanicalFindings = async ({ cwd, name, planPaths, decisions, overviewPath }: Params): Promise<SyncedPlanFile[]> => {
	const synced = await syncPlanDecisions({ cwd, name, planPaths, decisions });
	const files: SyncedPlanFile[] = [...('files' in synced ? synced.files : []), ...(await syncGlobalConstraints({ planPaths, decisions }))];

	if (overviewPath !== undefined) {
		const phasePaths = planPaths.filter((path) => path !== overviewPath);
		const stamped = await stampPhaseCounts({ overviewPath, phasePaths });

		files.push(
			await syncPhaseSections({
				overviewPath,
				declarations: await withOwnDeclarations({ declarations: stamped, phasePaths }),
				phaseFiles: phasePaths.map((path) => basename(path)),
			}),
		);
	}

	return files;
};
