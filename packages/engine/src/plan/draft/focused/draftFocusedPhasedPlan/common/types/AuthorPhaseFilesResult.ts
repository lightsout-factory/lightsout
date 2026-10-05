import type { PlanRunStatus } from '#src/common/constants/PlanRunStatus.ts';
import type { PlanDraftReport } from '#src/contracts/plan/draft/PlanDraftReport.ts';

export type AuthorPhaseFilesResult =
	| { status: typeof PlanRunStatus.Complete; planPaths: string[]; reports: PlanDraftReport[] }
	| { status: typeof PlanRunStatus.Failed; error: string }
	| { status: typeof PlanRunStatus.PausedRateLimit; error: string }
	| { status: typeof PlanRunStatus.FactsError; discrepancies: string[] };
