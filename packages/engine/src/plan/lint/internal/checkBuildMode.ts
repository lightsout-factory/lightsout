import { BuildMode } from '#src/common/constants/BuildMode.ts';
import { FindingSeverity } from '#src/contracts/plan/grade/FindingSeverity.ts';
import { StructuralCheck } from '#src/contracts/plan/grade/StructuralCheck.ts';
import type { StructuralFinding } from '#src/contracts/plan/grade/StructuralFinding.ts';
import type { ParsedPlan } from '#src/plan/internal/common/types/ParsedPlan.ts';

interface Params {
	plan: ParsedPlan;
	/** The finding label: this file's basename. */
	phase: string;
}

const finding = ({ phase, issue, fix }: { phase: string; issue: string; fix: string }) => ({
	check: StructuralCheck.BuildModeWellFormed,
	severity: FindingSeverity.Blocking,
	phase,
	issue,
	location: `${phase} → Build Mode`,
	fix,
});

/** The parser already refused every body but the one literal, so a section it did not read as that mode names none. */
const unknownModeDefects = ({ plan, phase }: Params) =>
	plan.sections.has('Build Mode') && plan.buildMode !== BuildMode.MoveFoldersAndFiles
		? [
				finding({
					phase,
					issue: "the '## Build Mode' section names no known build mode",
					fix: "make the section's first line read `move-folders-and-files`, or drop the section",
				}),
			]
		: [];

const separatePhase = 'or move that work into a separate standard phase, since a move and feature work are two phases';

/**
 * A move-folders-and-files file lists its moves and nothing else: its own path
 * updates are never listed, and it states no behaviour a new test could pin.
 * One finding per kind of work, never one per path.
 */
const moveOnlyDefects = ({ plan, phase }: Params) => {
	const modified = [...plan.modifyPaths, ...plan.earlierPhaseModifyPaths];
	const listed = [
		{
			count: plan.createPaths.length,
			issue: `a move-folders-and-files file lists files to create (${plan.createPaths.join(', ')}), but a move creates no file of its own`,
			fix: `drop the Files to Create entries, ${separatePhase}`,
		},
		{
			count: modified.length,
			issue: `a move-folders-and-files file lists files to modify (${modified.join(', ')}), but a move's own path updates are never listed`,
			fix: `drop the Files to Modify and Files to Modify from Earlier Phases entries, ${separatePhase}`,
		},
		{
			count: plan.deletePaths.length,
			issue: `a move-folders-and-files file lists files to delete (${plan.deletePaths.join(', ')}), but a move deletes no file`,
			fix: `drop the Files to Delete entries, ${separatePhase}`,
		},
		{
			count: plan.renames.length,
			issue: `a move-folders-and-files file lists ${plan.renames.length} rename(s), but a phase has exactly one build mode`,
			fix: "drop the '## Renames' section, or move the renames into a separate rename-only phase",
		},
		{
			count: plan.ledger.length,
			issue: `a move-folders-and-files file states ${plan.ledger.length} acceptance-test row(s), but a move adds no behaviour a new test could state and the build writes no tests for it`,
			fix: `keep the Acceptance Tests heading with no rows, ${separatePhase}`,
		},
	];

	return listed.filter(({ count }) => count > 0).map(({ issue, fix }) => finding({ phase, issue, fix }));
};

/**
 * Renames in a move-folders-and-files file are reported here rather than by
 * `checkRenames`' rename-only rules, so one mistake earns one finding.
 */
export const checkBuildMode = ({ plan, phase }: Params): StructuralFinding[] => [
	...unknownModeDefects({ plan, phase }),
	...(plan.buildMode === BuildMode.MoveFoldersAndFiles ? moveOnlyDefects({ plan, phase }) : []),
];
