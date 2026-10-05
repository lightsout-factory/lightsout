import { basename } from 'node:path';
import type { GradeInputs } from '#src/contracts/plan/memory/GradeInputs.ts';
import type { GradeMemory } from '#src/contracts/plan/memory/GradeMemory.ts';
import { GradeScope } from '#src/contracts/plan/memory/GradeScope.ts';
import type { DeliverableFile } from '#src/plan/common/types/DeliverableFile.ts';
import { gapCheckLenses } from '#src/plan/runPlanGrade/common/constants/gapCheckLenses.ts';
import { getCoverageSeeds } from '#src/plan/runPlanGrade/common/getCoverageSeeds/getCoverageSeeds.ts';
import { getDesignHashes } from '#src/plan/runPlanGrade/common/getDesignHashes.ts';
import { getEditedPhases } from '#src/plan/runPlanGrade/common/getEditedPhases.ts';
import { getPhaseGraph } from '#src/plan/runPlanGrade/common/getPhaseGraph/getPhaseGraph.ts';
import { getStandingCoverage } from '#src/plan/runPlanGrade/common/getStandingCoverage/getStandingCoverage.ts';
import type { GradeScopeDecision } from '#src/plan/runPlanGrade/common/types/GradeScopeDecision.ts';

interface Params {
	files: DeliverableFile[];
	overviewText?: string;
	memory?: GradeMemory;
	inputs: GradeInputs;
	/** True when a human passed `--phase`: a narrowed pass is never reused and never focused. */
	narrowed: boolean;
}

const everyPhase = ({ files }: { files: DeliverableFile[] }) => files.map((file) => basename(file.path));

/**
 * There is no flag, because a human cannot know which phases a repair can reach.
 * Every rule falls back to a full review: a cheaper pass must never turn an
 * unresolved blocker into an approval.
 *
 * Nothing here decides approval, so a pass whose coverage already stands
 * everywhere may read nothing at all and still grant an A.
 */
export const decideGradeScope = ({ files, overviewText, memory, inputs, narrowed }: Params): GradeScopeDecision => {
	const phases = everyPhase({ files });
	const full = ({ reason }: { reason: string }): GradeScopeDecision => ({ scope: GradeScope.Full, phases, reuse: false, reason });

	if (narrowed) {
		return full({ reason: 'full review: a human narrowed this pass with --phase, which the engine never overrides' });
	}

	if (inputs.gradedCommit === undefined || inputs.changedFiles === undefined) {
		return full({ reason: 'full review: the git probe did not run, so the state of the code beside the plan is unknown' });
	}

	if (memory?.lastPassingFullReview?.inputs.sha256 === inputs.sha256) {
		return { scope: GradeScope.Full, phases, reuse: true, reason: 'the recorded passing full review already covers these inputs' };
	}

	const previous = memory?.lastPass?.inputs;

	if (previous === undefined) {
		return full({ reason: 'full review: no earlier pass is on record, so this pass is the baseline' });
	}

	const { otherInputChanged } = getEditedPhases({ current: inputs, previous });

	if (otherInputChanged) {
		return full({ reason: 'full review: the code, standards, configuration, prompts or model moved since the last pass' });
	}

	const seeded = getCoverageSeeds({ inputs, previous, overviewText, phaseFiles: phases });

	if ('error' in seeded) {
		return full({ reason: `full review: ${seeded.error}` });
	}

	if (files.length < 2 || overviewText === undefined) {
		return full({ reason: 'full review: a single plan file has no phase closure to narrow to' });
	}

	const graph = getPhaseGraph({ files, overviewText });

	if ('error' in graph) {
		return full({ reason: `full review: the phase graph could not be built — ${graph.error}` });
	}

	const standing = getStandingCoverage({
		coverage: memory?.coverage ?? { readers: [] },
		designHashes: getDesignHashes({ inputs }),
		phaseFiles: phases,
		lenses: gapCheckLenses,
		connections: graph.connections,
		otherInputChanged: false,
		seeds: seeded.seeds,
	});

	if (standing.invalidated.length >= files.length) {
		return full({ reason: 'full review: no recorded reading still stands, so this pass reads every plan file anyway' });
	}

	const reach = standing.invalidated.length > 0 ? standing.invalidated.join(', ') : 'nothing — every plan file is covered at its current text';
	const reason = `focused review: the plan files whose recorded reading no longer stands — ${reach}`;

	return { scope: GradeScope.Focused, phases: standing.invalidated, reuse: false, reason };
};
