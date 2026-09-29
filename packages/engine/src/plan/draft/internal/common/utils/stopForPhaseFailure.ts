import { PlanRunStatus } from '#src/plan/common/constants/PlanRunStatus.ts';
import type { AuthorPhaseFilesResult } from '#src/plan/draft/internal/common/types/AuthorPhaseFilesResult.ts';
import type { createDraftStop } from '#src/plan/draft/internal/common/utils/createDraftStop.ts';
import type { RunPlanDraftResult } from '#src/plan/internal/common/types/RunPlanDraftResult.ts';

type FailedPhases = Exclude<AuthorPhaseFilesResult, { status: typeof PlanRunStatus.Complete }>;

interface Params {
	phases: FailedPhases;
	draftStop: ReturnType<typeof createDraftStop>;
}

export const stopForPhaseFailure = ({ phases, draftStop }: Params): RunPlanDraftResult => {
	let stop: RunPlanDraftResult;

	if (phases.status === PlanRunStatus.FactsError) {
		stop = draftStop({ status: PlanRunStatus.FactsError, discrepancies: phases.discrepancies });
	} else if (phases.status === PlanRunStatus.PausedRateLimit) {
		stop = draftStop({ status: PlanRunStatus.PausedRateLimit, error: phases.error });
	} else {
		stop = draftStop({ status: PlanRunStatus.Failed, error: phases.error });
	}

	return stop;
};
