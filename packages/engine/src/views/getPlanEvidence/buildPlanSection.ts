import { GradeFindingStatus } from '#src/contracts/plan/memory/GradeFindingStatus.ts';
import { EvidenceProvenance } from '#src/contracts/views/planEvidence/EvidenceProvenance.ts';
import { EvidenceSectionState } from '#src/contracts/views/planEvidence/EvidenceSectionState.ts';
import type { PlanEvidence } from '#src/contracts/views/planEvidence/PlanEvidence.ts';
import type { PlanWorkspaceView } from '#src/contracts/views/planWorkspace/PlanWorkspaceView.ts';
import { measuredCount } from '#src/views/common/measuredCount.ts';
import { reportedCount } from '#src/views/getPlanEvidence/common/reportedCount.ts';

interface Params {
	workspace: PlanWorkspaceView;
}

/**
 * The grader is an agent, so its passes, gaps and findings are reported; the structural
 * lint, the decision record and the path checks are deterministic, so they are measured.
 * Absent when planning recorded nothing and is not running.
 */
export const buildPlanSection = ({ workspace }: Params): PlanEvidence['plan'] => {
	const { gradePasses, gradeFindings, planningLive } = workspace;
	const rows = workspace.decisions?.decisions;
	const verification = workspace.facts?.verification;

	if (gradePasses.length === 0 && gradeFindings.length === 0 && rows === undefined && verification === undefined && !planningLive) {
		return undefined;
	}

	return {
		state: planningLive ? EvidenceSectionState.InProgress : EvidenceSectionState.Finished,
		gradePasses: gradePasses.map((pass) => ({
			gradedAt: pass.gradedAt,
			grade: pass.grade,
			gaps: reportedCount({ value: pass.gaps.length }),
			structural: measuredCount({ value: pass.structural.length }),
			provenance: EvidenceProvenance.Reported,
		})),
		findingsByStatus: Object.values(GradeFindingStatus).flatMap((status) => {
			const value = gradeFindings.filter((finding) => finding.status === status).length;

			return value === 0 ? [] : [{ status, count: reportedCount({ value }) }];
		}),
		questionsAsked: rows === undefined ? undefined : measuredCount({ value: rows.filter((row) => !row.assumption).length }),
		answeredWithoutUser: rows === undefined ? undefined : measuredCount({ value: rows.filter((row) => row.assumption).length }),
		pathsChecked: verification === undefined ? undefined : measuredCount({ value: verification.pathsChecked }),
		pathsMissing: verification === undefined ? undefined : measuredCount({ value: verification.missingPaths.length }),
		scriptsChecked: verification === undefined ? undefined : measuredCount({ value: verification.scriptsChecked }),
		scriptsMissing: verification === undefined ? undefined : measuredCount({ value: verification.missingScripts.length }),
	};
};
