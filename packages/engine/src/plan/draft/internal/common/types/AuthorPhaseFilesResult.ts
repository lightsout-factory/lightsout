import type { PlanDraftReport } from '#src/contracts/plan/draft/PlanDraftReport.ts';
import type { PlanRunStatus } from '#src/plan/common/constants/PlanRunStatus.ts';

export type AuthorPhaseFilesResult =
	| { status: typeof PlanRunStatus.Complete; planPaths: string[]; reports: PlanDraftReport[] }
	| { status: typeof PlanRunStatus.Failed; error: string }
	| { status: typeof PlanRunStatus.PausedRateLimit; error: string }
	| { status: typeof PlanRunStatus.FactsError; discrepancies: string[] };
