import { getPlanWrittenPaths } from '#src/plan/internal/common/paths/getPlanWrittenPaths.ts';
import type { ParsedPlan } from '#src/plan/internal/common/types/ParsedPlan.ts';

interface Params {
	plan: ParsedPlan;
}

export const getPlanHeadingPaths = ({ plan }: Params): string[] => [
	...getPlanWrittenPaths({ plan }),
	...plan.deletePaths,
	...plan.movePaths.flatMap((move) => [move.from, move.to]),
];
