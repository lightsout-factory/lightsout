import { getPlanHeadingPaths } from '#src/plan/common/paths/getPlanHeadingPaths.ts';
import type { ParsedPlan } from '#src/plan/common/types/ParsedPlan.ts';

interface Params {
	plan: ParsedPlan;
	/** `## Patterns to Mirror` — files the plan reads rather than writes, which only the script check cares about. */
	includeMirrors?: boolean;
}

/**
 * The ledger's test files are included because the ledger section declares
 * them, so the prose-path check must not report them as naming nothing. They
 * never reach the size numbers: `isPlanSourceFile` excludes tests.
 */
export const getPlanNamedPaths = ({ plan, includeMirrors = false }: Params): string[] => [
	...getPlanHeadingPaths({ plan }),
	...plan.ledger.map((row) => row.testFile),
	...(includeMirrors ? plan.mirrorPaths : []),
];
