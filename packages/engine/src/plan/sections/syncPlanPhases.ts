import { basename } from 'node:path';
import { PlanRunStatus } from '#src/common/constants/PlanRunStatus.ts';
import type { PhaseDeclaration } from '#src/common/types/PhaseDeclaration.ts';
import { getPhaseSetDefects } from '#src/plan/common/phases/getPhaseSetDefects.ts';
import { parsePhaseDeclarations } from '#src/plan/common/phases/parsePhaseDeclarations.ts';
import { resolvePlanDeliverable } from '#src/plan/common/resolvePlanDeliverable.ts';
import type { SyncedPlanFile } from '#src/plan/common/types/SyncedPlanFile.ts';
import { parsePlan } from '#src/plan/parsePlan/parsePlan.ts';
import { syncPhaseSectionsFromFiles } from '#src/plan/sections/syncPhaseSectionsFromFiles/syncPhaseSectionsFromFiles.ts';

interface Params {
	cwd: string;
	/** A plan address — what the deliverable is resolved by. */
	name: string;
}

type SyncPlanPhasesResult = { status: typeof PlanRunStatus.Complete; file: SyncedPlanFile } | { status: typeof PlanRunStatus.Failed; error: string };

/** A numbered row whose phase has no `### Phase <N>` block: the one mismatch `getPhaseSetDefects` does not cover. */
const missingBlockDefects = ({ declarations, phaseFiles }: { declarations: PhaseDeclaration[]; phaseFiles: string[] }) => {
	const unblocked = declarations.filter((row) => row.number > 0 && row.blockRange === undefined && phaseFiles.includes(row.file));

	return unblocked.map((row) => ({
		issue: `phase ${row.number} ('${row.file}') has a '## Phases' row but no '## Phase Declarations' block`,
		fix: `add a '### Phase ${row.number}' block for ${row.file}`,
	}));
};

/**
 * Restates a phased overview's `## Phases` table and `## Phase Declarations`
 * from its phase files once the breakdown changes after drafting. A mismatch is
 * refused rather than synced around: silently dropping a row would hide the
 * mistake, and renumbering or renaming files the caller is editing is theirs to
 * do.
 *
 * Every refusal is settled before the first write, so the overview is never left
 * half-synced. The return type is annotated because inferred, the union
 * normalizes to one member carrying an optional `error`, which breaks the
 * caller's narrowing.
 */
export const syncPlanPhases = async ({ cwd, name }: Params): Promise<SyncPlanPhasesResult> => {
	const deliverable = await resolvePlanDeliverable({ cwd, name });

	if (deliverable.error !== undefined) {
		return { status: PlanRunStatus.Failed, error: deliverable.error };
	}

	if (deliverable.overviewPath === undefined || deliverable.overviewText === undefined) {
		return { status: PlanRunStatus.Failed, error: `cannot sync phases for '${name}': it has no overview.md, so there is no phase breakdown to sync` };
	}

	const overviewBase = basename(deliverable.overviewPath);
	const phaseFiles = deliverable.files.map((file) => basename(file.path));
	const declarations = parsePhaseDeclarations({ plan: parsePlan({ content: deliverable.overviewText, base: overviewBase }) });
	const defects = [...getPhaseSetDefects({ declarations, phaseFiles, overviewBase }), ...missingBlockDefects({ declarations, phaseFiles })];

	if (defects.length > 0) {
		return {
			status: PlanRunStatus.Failed,
			error: [
				`cannot sync phases for '${name}': the phase files and the overview's breakdown do not line up`,
				...defects.map((defect) => `  ${defect.issue} — ${defect.fix}`),
				'Adding a missing row or block, and renumbering or renaming phase files, is your own edit; make it, then run this command again.',
			].join('\n'),
		};
	}

	const file = await syncPhaseSectionsFromFiles({ cwd, overviewPath: deliverable.overviewPath, phasePaths: deliverable.files.map((phase) => phase.path) });

	return { status: PlanRunStatus.Complete, file };
};
