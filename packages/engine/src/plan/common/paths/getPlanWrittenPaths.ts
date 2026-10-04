import type { ParsedPlan } from '#src/plan/common/types/ParsedPlan.ts';

interface Params {
	plan: ParsedPlan;
}

/** Narrower than `getPlanHeadingPaths` on purpose: no test can state the behaviour of a file the plan deletes or moves away. */
export const getPlanWrittenPaths = ({ plan }: Params): string[] => [...plan.createPaths, ...plan.modifyPaths, ...plan.earlierPhaseModifyPaths];
