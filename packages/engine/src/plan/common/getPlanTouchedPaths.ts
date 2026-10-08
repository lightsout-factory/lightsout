import { getPlanNamedPaths } from '#src/plan/common/getPlanNamedPaths.ts';
import { isPlanSourceFile } from '#src/plan/common/paths/isPlanSourceFile.ts';
import type { ParsedPlan } from '#src/plan/common/types/ParsedPlan.ts';

interface Params {
	plan: ParsedPlan;
	/** The repo's `test-files` globs: a test file is never counted. */
	testFileGlobs: string[];
}

/**
 * A move destination is deliberately not a creation. The created-file ceiling
 * measures how much a phase must SPECIFY, and a moved file is already written.
 * Counting moves would block a large relocation with no escape: `## File
 * Budget` raises the touched count and never the ceiling. Moves still count in
 * `touched`, on both sides.
 */
export const getPlanTouchedPaths = ({ plan, testFileGlobs }: Params): { created: string[]; touched: string[] } => {
	const created = plan.createPaths.filter((path) => isPlanSourceFile({ path, testFileGlobs }));
	const touched = getPlanNamedPaths({ plan }).filter((path) => isPlanSourceFile({ path, testFileGlobs }));

	return { created: [...new Set(created)], touched: [...new Set(touched)] };
};
