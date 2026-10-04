import type { PhaseDeclaration } from '#src/common/types/PhaseDeclaration.ts';
import { getDeclarationDefects } from '#src/plan/common/getDeclarationDefects.ts';
import type { PhaseDefect } from '#src/plan/common/types/PhaseDefect.ts';

interface Params {
	/** Orphan blocks included. */
	declarations: PhaseDeclaration[];
	/** Basenames of the plan's phase files, overview excluded. */
	phaseFiles: string[];
	/** The overview's basename: the label and location prefix of every declaration-side defect. */
	overviewBase: string;
}

/**
 * Which phase files and declarations fail to line up. Shared by the lint and
 * `plan sync-phases` so both refuse the same set in the same words:
 * `getFindingSetKey` keys the repair loop's no-progress detection on these
 * strings, so a second copy drifting by a word would break it.
 */
export const getPhaseSetDefects = ({ declarations, phaseFiles, overviewBase }: Params): PhaseDefect[] => {
	const defects: PhaseDefect[] = [];

	for (const declaration of declarations.filter((candidate) => !phaseFiles.includes(candidate.file))) {
		defects.push({
			phase: overviewBase,
			issue: `the phase breakdown declares '${declaration.file}', which is not one of this plan's phase files`,
			location: `${overviewBase} → ${declaration.file}`,
			fix: 'correct the filename, or drop the row and its declaration block',
		});
	}

	for (const phaseFile of phaseFiles.filter((candidate) => !declarations.some((declaration) => declaration.file === candidate))) {
		defects.push({
			phase: phaseFile,
			issue: "this phase file has no row in the overview's phase breakdown",
			location: phaseFile,
			fix: `add a '## Phases' row and a '## Phase Declarations' block for ${phaseFile}`,
		});
	}

	defects.push(
		...getDeclarationDefects({
			declarations,
			locations: {
				declarationsSection: `${overviewBase} → Phase Declarations`,
				phasesTable: `${overviewBase} → Phases`,
				phaseRow: (file) => `${overviewBase} → ${file}`,
			},
		}).map((defect) => ({ phase: overviewBase, ...defect })),
	);

	return defects;
};
