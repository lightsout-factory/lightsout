import type { StructuralFinding } from '#src/contracts/plan/grade/StructuralFinding.ts';
import type { RunPlanDraftResult } from '#src/plan/internal/common/types/RunPlanDraftResult.ts';

/** Distributes across the result union so every member keeps its own shape instead of collapsing into one merged object. */
type DraftStopFields<Result> = Result extends unknown ? Omit<Result, 'workspaceDir' | 'advisories'> : never;

interface Params {
	workspaceDir: string;
	/** Read at each stop rather than at creation, so a warning raised on the way past one check rides every exit after it. */
	advisories: StructuralFinding[];
}

export const createDraftStop = ({ workspaceDir, advisories }: Params): ((fields: DraftStopFields<RunPlanDraftResult>) => RunPlanDraftResult) => {
	return (fields) => ({ ...fields, workspaceDir, advisories: [...advisories] });
};
