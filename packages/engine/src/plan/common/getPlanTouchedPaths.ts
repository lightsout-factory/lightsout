import type { RepoFileGlobs } from '#src/common/types/RepoFileGlobs.ts';
import { getPlanNamedPaths } from '#src/plan/common/getPlanNamedPaths.ts';
import { isPlanSourceFile } from '#src/plan/common/paths/isPlanSourceFile.ts';
import type { ParsedPlan } from '#src/plan/common/types/ParsedPlan.ts';

interface Params {
	plan: ParsedPlan;
	/** The repo's own globs: which files are code, and which of those are tests. */
	fileGlobs: RepoFileGlobs;
}

/**
 * A move destination is deliberately not a creation. The created-file ceiling
 * measures how much a phase must SPECIFY, and a moved file is already written.
 * Counting moves would block a large relocation with no escape: `## File
 * Budget` raises the touched count and never the ceiling. Moves still count in
 * `touched`, on both sides.
 */
export const getPlanTouchedPaths = ({ plan, fileGlobs }: Params): { created: string[]; touched: string[] } => {
	const created = plan.createPaths.filter((path) => isPlanSourceFile({ path, fileGlobs }));
	const touched = getPlanNamedPaths({ plan }).filter((path) => isPlanSourceFile({ path, fileGlobs }));

	return { created: [...new Set(created)], touched: [...new Set(touched)] };
};
