import type { StepRecord } from '#src/contracts/run/StepRecord.ts';
import type { SupervisorVerdict } from '#src/contracts/work/SupervisorVerdict.ts';
import type { VerificationResult } from '#src/pipeline/internal/common/types/VerificationResult.ts';
import type { PipelineResult } from '#src/pipeline/PipelineResult.ts';

/** Its own type rather than an optional field on `RepairOutcome`: no other stage consults the supervisor. */
export type GuidedRepairOutcome = { parked: PipelineResult } | { record: StepRecord; result: VerificationResult; ruling: SupervisorVerdict | undefined };
