import type { PlanBuildMode } from '#src/common/types/PlanBuildMode.ts';
import type { AcceptanceTestRecord } from '#src/contracts/run/AcceptanceTestRecord.ts';
import type { PipelineRun } from '#src/pipeline/internal/PipelineRun.ts';
import type { FixBuilder } from '#src/pipeline/internal/steps/common/types/FixBuilder.ts';

/** A named type rather than each stage's own `Params`: the stages hand it on unchanged, and a copied shape at each hop drifts. */
export interface VerifyContext {
	run: PipelineRun;
	gitPrefix?: string;
	planContent: string;
	overviewContent?: string;
	id: string;
	coverage?: boolean;
	/** Read at every entry into the gates: a row a disposition renamed or moved during this checkpoint is proven under its new name. */
	acceptanceTests: () => AcceptanceTestRecord[];
	/** True only at the run's last verification, where an acceptance test no gate proved is a failure rather than a skip. */
	final?: boolean;
	/** A mechanical mode turns the checkpoint's test-change review into that mode's code check. */
	planBuildMode: PlanBuildMode;
	buildFix: FixBuilder;
}
