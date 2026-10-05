import type { PipelineRun } from '#src/pipeline/common/PipelineRun.ts';
import type { TestTargetGroup } from '#src/pipeline/steps/common/types/TestTargetGroup.ts';

/**
 * @typeParam TGroup - what one writer was given: a coverage group by default, a ledger test file's rows in the ledger step.
 */
export type WriterResult<TGroup = TestTargetGroup> = Awaited<ReturnType<PipelineRun['invokeRole']>> & { group: TGroup };
