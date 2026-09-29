import { PlanProgress } from '#src/contracts/workOrder/PlanProgress.ts';

interface Params {
	progress: PlanProgress;
}

const planProgressWording: Record<PlanProgress, string> = {
	[PlanProgress.Planning]: 'being planned',
	[PlanProgress.Ready]: 'ready to implement',
	[PlanProgress.Implementing]: 'its implementation has not finished',
	[PlanProgress.Implemented]: 'implemented',
	[PlanProgress.Failed]: 'its implementation failed',
};

/**
 * Worded so a plan that is only ready to implement never reads as implemented,
 * and one whose implementation has not finished is never called unfinished.
 */
export const describePlanProgress = ({ progress }: Params): string => planProgressWording[progress];
