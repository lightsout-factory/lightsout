import type { StepRecord } from '#src/contracts/run/StepRecord.ts';
import type { PipelineResult } from '#src/pipeline/PipelineResult.ts';
import type { VerificationResult } from '#src/pipeline/steps/common/types/VerificationResult.ts';

export type RepairOutcome = { parked: PipelineResult } | { record: StepRecord; result: VerificationResult };
