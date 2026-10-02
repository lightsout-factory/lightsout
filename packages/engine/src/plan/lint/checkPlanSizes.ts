import { BuildMode } from '#src/common/constants/BuildMode.ts';
import { createdFileCeiling } from '#src/common/constants/createdFileCeiling.ts';
import { touchedFileCeiling } from '#src/common/constants/touchedFileCeiling.ts';
import { FindingSeverity } from '#src/contracts/plan/grade/FindingSeverity.ts';
import { StructuralCheck } from '#src/contracts/plan/grade/StructuralCheck.ts';
import type { StructuralFinding } from '#src/contracts/plan/grade/StructuralFinding.ts';
import type { PhaseFile } from '#src/plan/common/types/PhaseFile.ts';
import type { PhaseSizeCounts } from '#src/plan/internal/common/types/PhaseSizeCounts.ts';

interface Params {
	phase: PhaseFile;
	/** The default budget a plan may declare its own replacement for. */
	fileLimit: number;
	counts: PhaseSizeCounts;
}

/**
 * A mechanical plan is exempt from the touched ceiling, because a repo-wide
 * rename's or move's size is not what makes it hard. A move-folders-and-files
 * plan is also exempt from its file budget, so it earns no over-budget advisory.
 */
export const checkPlanSizes = ({ phase, fileLimit, counts }: Params): StructuralFinding[] => {
	const findings: StructuralFinding[] = [];
	const { created, touched } = counts;
	const budget = phase.plan.fileBudget ?? fileLimit;

	if (created > createdFileCeiling) {
		findings.push({
			check: StructuralCheck.CreatedFilesWithinCeiling,
			severity: FindingSeverity.Blocking,
			phase: phase.base,
			issue: `plan creates ${created} source files, over the ${createdFileCeiling}-file ceiling`,
			location: phase.base,
			fix: `split the phase so it creates no more than ${createdFileCeiling} files`,
		});
	}

	if (touched > touchedFileCeiling && phase.plan.buildMode === BuildMode.Standard) {
		findings.push({
			check: StructuralCheck.TouchedFilesWithinCeiling,
			severity: FindingSeverity.Blocking,
			phase: phase.base,
			issue: `plan touches ${touched} source files, over the ${touchedFileCeiling}-file ceiling`,
			location: phase.base,
			fix: `split the phase so it touches no more than ${touchedFileCeiling} files — or declare it rename-only with a '## Renames' section if its whole work is renaming, or move-folders-and-files with a '## Build Mode' section reading \`move-folders-and-files\` if its whole work is moving folders and files`,
		});
	}

	if (touched > budget && phase.plan.buildMode !== BuildMode.MoveFoldersAndFiles) {
		const source = phase.plan.fileBudget === undefined ? 'the configured executor-file-limit' : "this plan's own ## File Budget";

		findings.push({
			check: StructuralCheck.ScopeWithinGuardrail,
			severity: FindingSeverity.Advisory,
			phase: phase.base,
			issue: `plan touches ${touched} source files, over the ${budget}-file limit from ${source}`,
			location: phase.base,
			fix: `legal, but the implementing agent stops at ${budget} files — a mostly-mechanical phase should declare a '## File Budget' covering its real touched count`,
		});
	}

	return findings;
};
