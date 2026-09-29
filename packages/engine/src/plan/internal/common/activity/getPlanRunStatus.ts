import { RunStatus } from '#src/contracts/run/RunStatus.ts';
import { PlanRunStatus } from '#src/plan/common/constants/PlanRunStatus.ts';

interface Params {
	status: PlanRunStatus;
}

/** A parked status stays parked rather than becoming a failure: the wall is resumable, and the report has to be able to say so. */
export const getPlanRunStatus = ({ status }: Params): RunStatus =>
	status === PlanRunStatus.Complete ? RunStatus.Passed : status === PlanRunStatus.PausedRateLimit ? RunStatus.PausedRateLimit : RunStatus.Failed;
