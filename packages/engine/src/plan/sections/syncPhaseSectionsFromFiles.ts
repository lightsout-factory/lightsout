import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { BuildMode } from '#src/common/constants/BuildMode.ts';
import type { PhaseDeclaration } from '#src/plan/common/types/PhaseDeclaration.ts';
import type { SyncedPlanFile } from '#src/plan/common/types/SyncedPlanFile.ts';
import { stampPhaseCounts } from '#src/plan/draft/stampPhaseCounts.ts';
import { parsePlan } from '#src/plan/parsePlan.ts';
import { syncPhaseSections } from '#src/plan/sections/syncPhaseSections.ts';

interface Params {
	/** The run's working directory, from which git lists the files a folder move carries. */
	cwd: string;
	/** Absolute path of the overview to rewrite in place. */
	overviewPath: string;
	/** Absolute paths of the phase files, overview excluded. */
	phasePaths: string[];
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
 * The one rebuild of a phased overview's `## Phases` table and `## Phase
 * Declarations`, shared by the draft path, the repair path and `plan
 * sync-phases`.
 *
 * The stamp has to run before the sections are rendered, or the overview
 * agent's estimated counts are written back over the real ones. Malformed input
 * is tolerated as `syncPhaseSections` tolerates it: refusing a mismatch is the
 * caller's decision, since the draft and repair paths repair around one.
 */
export const syncPhaseSectionsFromFiles = async ({ cwd, overviewPath, phasePaths }: Params): Promise<SyncedPlanFile> => {
	const before = await readFile(overviewPath, 'utf8');
	const stamped = await stampPhaseCounts({ cwd, overviewPath, phasePaths });

	await syncPhaseSections({
		overviewPath,
		declarations: await withOwnDeclarations({ declarations: stamped, phasePaths }),
		phaseFiles: phasePaths.map((path) => basename(path)),
	});

	return { path: overviewPath, updated: (await readFile(overviewPath, 'utf8')) !== before };
};
