import type { StepRecord } from '#src/contracts/run/StepRecord.ts';
import type { VerificationResult } from '#src/pipeline/internal/common/types/VerificationResult.ts';
import type { PipelineResult } from '#src/pipeline/PipelineResult.ts';

export type RepairOutcome = { parked: PipelineResult } | { record: StepRecord; result: VerificationResult };
