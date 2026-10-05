import { PlanRunStatus } from '#src/common/constants/PlanRunStatus.ts';
import type { RunPlanDraftResult } from '#src/plan/draft/common/types/RunPlanDraftResult.ts';
import type { createDraftStop } from '#src/plan/draft/focused/common/createDraftStop.ts';
import type { AuthorPhaseFilesResult } from '#src/plan/draft/focused/draftFocusedPhasedPlan/common/types/AuthorPhaseFilesResult.ts';

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
