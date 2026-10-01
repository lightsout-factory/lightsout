import type { PhaseDeclaration } from '#src/plan/common/types/PhaseDeclaration.ts';
import type { SyncedPlanFile } from '#src/plan/common/types/SyncedPlanFile.ts';
import { generatedPlanRegions } from '#src/plan/internal/common/constants/generatedPlanRegions.ts';
import { renderPhaseDeclaration } from '#src/plan/sections/renderPhaseDeclaration.ts';
import { renderPhaseRow } from '#src/plan/sections/renderPhaseRow.ts';
import { writePlanSection } from '#src/plan/sections/writePlanSection.ts';

interface Params {
	/** Absolute. */
	overviewPath: string;
	/** One row per phase, in phase order. */
	declarations: PhaseDeclaration[];
	/** Basenames. A declaration naming anything else is not rendered. */
	phaseFiles: string[];
}

const composedNote =
	"Composed by `lightsout plan draft` from this plan's phase files. When the phase breakdown changes, edit this row or block for each changed phase, then run `lightsout plan sync-phases` to restate the rest.";

const renderPhasesSection = ({ declarations }: { declarations: PhaseDeclaration[] }) => {
	const headerRow = '| # | File | Scope | Creates | Touches |';
	const separatorRow = '|---|------|-------|---------|---------|';
	const rows = declarations.map((declaration) => renderPhaseRow({ declaration }));

	return `## Phases\n\n${composedNote}\n\n${[headerRow, separatorRow, ...rows].join('\n')}`;
};

const renderDeclarationsSection = ({ declarations }: { declarations: PhaseDeclaration[] }) => {
	const blocks = declarations.map((declaration) => renderPhaseDeclaration({ declaration }));

	return `## Phase Declarations\n\n${composedNote}\n\n${blocks.join('\n\n')}`;
};

/**
 * Both sections are rendered whole from one record so the two copies cannot
 * drift; prose written inside either does not survive a sync.
 *
 * `parsePhaseDeclarations` preserves malformed input (orphans numbered zero,
 * rows naming unknown files). Rendering those would fabricate rows, so only
 * matched entries render, and an empty match is a no-op rather than a wipe. What
 * is left untouched is reported by the round's lint.
 */
export const syncPhaseSections = async ({ overviewPath, declarations, phaseFiles }: Params): Promise<SyncedPlanFile> => {
	const known = new Set(phaseFiles);
	const matched = declarations.filter((declaration) => declaration.number > 0 && known.has(declaration.file));

	if (matched.length === 0) {
		return { path: overviewPath, updated: false };
	}

	const phases = await writePlanSection({
		path: overviewPath,
		heading: generatedPlanRegions.phases,
		section: renderPhasesSection({ declarations: matched }),
		after: generatedPlanRegions.globalConstraints,
	});
	const blocks = await writePlanSection({
		path: overviewPath,
		heading: generatedPlanRegions.phaseDeclarations,
		section: renderDeclarationsSection({ declarations: matched }),
		after: generatedPlanRegions.phases,
	});

	return { path: overviewPath, updated: phases.updated || blocks.updated };
};
