import type { PlanGrade } from '#src/contracts/plan/grade/PlanGrade.ts';
import { RunStatus } from '#src/contracts/run/RunStatus.ts';
import { PlanStage } from '#src/contracts/views/planWorkspace/PlanStage.ts';
import type { PlanWorkspaceListing } from '#src/contracts/views/planWorkspace/PlanWorkspaceListing.ts';
import type { RunListing } from '#src/contracts/views/RunListing.ts';
import type { PlanWorkspaceFiles } from '#src/views/common/types/PlanWorkspaceFiles.ts';

/**
 * Each step overwrites the one before, so the last condition that holds is the
 * answer. `Implemented` needs a run that PASSED: a plan mid-implementation, or
 * one whose run failed, keeps the stage its files give it and stays counted
 * among the open plans.
 */
const derivePlanStage = ({ files, hasGrade, runs }: { files: PlanWorkspaceFiles; hasGrade: boolean; runs: RunListing[] }) => {
	let stage: PlanStage = PlanStage.Started;

	if (files.notesFile !== undefined) {
		stage = PlanStage.NotesOnly;
	}

	if (files.planFile !== undefined) {
		stage = PlanStage.Drafted;
	}

	if (hasGrade) {
		stage = PlanStage.Graded;
	}

	if (runs.some((run) => run.status === RunStatus.Passed)) {
		stage = PlanStage.Implemented;
	}

	return stage;
};

interface Params {
	name: string;
	files: PlanWorkspaceFiles;
	/** `grade.json` is on disk — which is what makes a workspace graded, whether or not the file parses. */
	hasGrade: boolean;
	/** The grade that file carried, absent when it would not parse. */
	grade?: PlanGrade;
	/** The runs already matched to this workspace. */
	runs: RunListing[];
}

export const buildPlanWorkspaceListing = ({ name, files, hasGrade, grade, runs }: Params): PlanWorkspaceListing => ({
	name,
	stage: derivePlanStage({ files, hasGrade, runs }),
	grade,
	hasNotes: files.notesFile !== undefined,
	hasPlanFile: files.planFile !== undefined,
	implementedFiles: files.implementedFiles,
	// A phased plan is the one whose drafted file is an overview; `plan.md` is a
	// single plan however many stray phase files sit beside it.
	phased: files.planFile?.name === 'overview.md',
	phaseCount: files.phaseFiles.length,
	updatedAt: files.updatedAt,
	runCount: runs.length,
});
