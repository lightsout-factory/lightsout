import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import type { PhaseDeclaration } from '#src/plan/common/types/PhaseDeclaration.ts';
import type { SyncedPlanFile } from '#src/plan/common/types/SyncedPlanFile.ts';
import { stampPhaseCounts } from '#src/plan/draft/stampPhaseCounts.ts';
import { parsePlan } from '#src/plan/parsePlan.ts';
import { syncPhaseSections } from '#src/plan/sections/syncPhaseSections.ts';

interface Params {
	/** Absolute path of the overview to rewrite in place. */
	overviewPath: string;
	/** Absolute paths of the phase files, overview excluded. */
	phasePaths: string[];
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
 * The one rebuild of a phased overview's `## Phases` table and `## Phase
 * Declarations`, shared by the draft path, the repair path and `plan
 * sync-phases`.
 *
 * The stamp has to run before the sections are rendered, or the overview
 * agent's estimated counts are written back over the real ones. Malformed input
 * is tolerated as `syncPhaseSections` tolerates it: refusing a mismatch is the
 * caller's decision, since the draft and repair paths repair around one.
 */
export const syncPhaseSectionsFromFiles = async ({ overviewPath, phasePaths }: Params): Promise<SyncedPlanFile> => {
	const before = await readFile(overviewPath, 'utf8');
	const stamped = await stampPhaseCounts({ overviewPath, phasePaths });

	await syncPhaseSections({
		overviewPath,
		declarations: await withOwnDeclarations({ declarations: stamped, phasePaths }),
		phaseFiles: phasePaths.map((path) => basename(path)),
	});

	return { path: overviewPath, updated: (await readFile(overviewPath, 'utf8')) !== before };
};
