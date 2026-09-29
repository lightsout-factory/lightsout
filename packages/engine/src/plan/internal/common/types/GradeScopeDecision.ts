import type { GradeScope } from '#src/contracts/plan/memory/GradeScope.ts';

export interface GradeScopeDecision {
	scope: GradeScope;
	/** Every file for a full pass; the closure for a focused one. */
	phases: string[];
	/** True when a passing full review already covers these inputs, so nothing is spawned and nothing is written. */
	reuse: boolean;
	reason: string;
}
