import type { PlanningStepRecord } from '#src/contracts/plan/progress/PlanningStepRecord.ts';
import { RunStatus } from '#src/contracts/run/RunStatus.ts';
import { isPidAlive } from '#src/runState/liveness/isPidAlive.ts';

interface Params {
	step: PlanningStepRecord;
}

/**
 * Judged by the recorded status first and the recorded pid second, so a
 * settled step reads as settled whatever became of its process.
 */
export const isPlanningStepLive = ({ step }: Params): boolean => step.status === RunStatus.Running && isPidAlive({ pid: step.pid });
