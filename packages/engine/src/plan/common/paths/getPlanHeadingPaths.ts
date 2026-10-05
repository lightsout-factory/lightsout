import { getPlanWrittenPaths } from '#src/plan/common/paths/getPlanWrittenPaths.ts';
import type { ParsedPlan } from '#src/plan/common/types/ParsedPlan.ts';

interface Params {
	plan: ParsedPlan;
}

export const getPlanHeadingPaths = ({ plan }: Params): string[] => [
	...getPlanWrittenPaths({ plan }),
	...plan.deletePaths,
	...plan.movePaths.flatMap((move) => [move.from, move.to]),
];
