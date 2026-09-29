import { isPlanSourceFile } from '#src/plan/internal/common/paths/isPlanSourceFile.ts';
import type { ParsedPlan } from '#src/plan/internal/common/types/ParsedPlan.ts';
import { getPlanNamedPaths } from '#src/plan/internal/common/utils/getPlanNamedPaths.ts';

interface Params {
	plan: ParsedPlan;
}

/**
 * A move destination is deliberately not a creation. The created-file ceiling
 * measures how much a phase must SPECIFY, and a moved file is already written.
 * Counting moves would block a large relocation with no escape: `## File
 * Budget` raises the touched count and never the ceiling. Moves still count in
 * `touched`, on both sides.
 */
export const getPlanTouchedPaths = ({ plan }: Params): { created: string[]; touched: string[] } => {
	const created = plan.createPaths.filter((path) => isPlanSourceFile({ path }));
	const touched = getPlanNamedPaths({ plan }).filter((path) => isPlanSourceFile({ path }));

	return { created: [...new Set(created)], touched: [...new Set(touched)] };
};
