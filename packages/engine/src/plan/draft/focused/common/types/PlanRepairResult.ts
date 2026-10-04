import type { PlanRunStatus } from '#src/common/constants/PlanRunStatus.ts';
import type { StructuralFinding } from '#src/contracts/plan/grade/StructuralFinding.ts';

/** `findings` includes advisories so the caller can print them; it is empty of blockers when the loop converged. */
export type PlanRepairResult =
	| { status: typeof PlanRunStatus.Complete; findings: StructuralFinding[] }
	| { status: typeof PlanRunStatus.Failed; error: string }
	| { status: typeof PlanRunStatus.PausedRateLimit; error: string };
