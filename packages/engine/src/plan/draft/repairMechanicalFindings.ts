import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
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
 * The phase file's budget and rename-only flag win because that is the file the
 * implementing agent is handed. `stampPhaseCounts` deliberately does not stamp
 * these: the check it serves has to be able to see the two copies disagree.
 *
 * A phase file with no renames drops the `renamesOnly` key outright rather than
 * setting it to false, so the rendered block carries no bullet at all.
 */
const withOwnDeclarations = async ({ declarations, phasePaths }: { declarations: PhaseDeclaration[]; phasePaths: string[] }) => {
	const owned = new Map<string, { fileBudget?: number; renamesOnly: boolean }>();

	for (const phasePath of phasePaths) {
		const base = basename(phasePath);
		const plan = parsePlan({ content: await readFile(phasePath, 'utf8'), base });

		owned.set(base, { fileBudget: plan.fileBudget, renamesOnly: plan.renames.length > 0 });
	}

	return declarations.map((declaration) => {
		const own = owned.get(declaration.file);

		if (own === undefined) {
			return declaration;
		}

		const { renamesOnly: _renamesOnly, ...rest } = declaration;

		return { ...rest, fileBudget: own.fileBudget, ...(own.renamesOnly ? { renamesOnly: true } : {}) };
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
