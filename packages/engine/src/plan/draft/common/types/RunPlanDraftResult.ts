import type { PlanRunStatus } from '#src/common/constants/PlanRunStatus.ts';
import type { PlanDraftReport } from '#src/contracts/plan/draft/PlanDraftReport.ts';
import type { PlanVariant } from '#src/contracts/plan/draft/PlanVariant.ts';
import type { StructuralFinding } from '#src/contracts/plan/grade/StructuralFinding.ts';

interface PlanDraftComplete {
	status: typeof PlanRunStatus.Complete;
	workspaceDir: string;
	planPaths: string[];
	variant: PlanVariant;
	/** The overview spawn's report first, then one per phase in phase order. */
	reports: PlanDraftReport[];
	advisories: StructuralFinding[];
}

interface PlanDraftFailed {
	status: typeof PlanRunStatus.Failed;
	workspaceDir: string;
	error: string;
	advisories: StructuralFinding[];
}

interface PlanDraftPaused {
	status: typeof PlanRunStatus.PausedRateLimit;
	workspaceDir: string;
	error: string;
	advisories: StructuralFinding[];
}

/** The inputs are wrong, so the draft never loops. */
interface PlanDraftFactsError {
	status: typeof PlanRunStatus.FactsError;
	workspaceDir: string;
	discrepancies: string[];
	advisories: StructuralFinding[];
}

interface PlanDraftStructuralIssues {
	status: typeof PlanRunStatus.StructuralIssues;
	workspaceDir: string;
	findings: StructuralFinding[];
	planPaths: string[];
	advisories: StructuralFinding[];
}

/** `advisories` rides every member: the human wants it whichever way the draft ended. */
export type RunPlanDraftResult = PlanDraftComplete | PlanDraftFailed | PlanDraftPaused | PlanDraftFactsError | PlanDraftStructuralIssues;
