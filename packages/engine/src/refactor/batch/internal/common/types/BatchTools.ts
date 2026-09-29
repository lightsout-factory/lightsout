import type { StandardsFinding } from '#src/contracts/standardsCheck/StandardsFinding.ts';
import type { runBatchGates } from '#src/gates/runBatchGates.ts';
import type { BatchRecorder } from '#src/refactor/batch/internal/common/types/BatchRecorder.ts';
import type { BatchSiteChecker } from '#src/refactor/batch/internal/common/types/BatchSiteChecker.ts';
import type { invokeBatchAgent } from '#src/refactor/batch/internal/invokeBatchAgent.ts';
import type { settleBatchGates } from '#src/refactor/batch/internal/settleBatchGates.ts';
import type { reviewBatchOutput } from '#src/refactor/batch/reviewBatchOutput.ts';

export interface BatchTools {
	/** Counts against the attempt budget. */
	invoke: (params: { label: string; invocation: { systemPrompt: string; prompt: string } }) => ReturnType<typeof invokeBatchAgent>;
	/** The batch's report as it stands, without ending the batch. */
	reportOf: BatchRecorder['reportOf'];
	/** Merges git truth into the files the batch claims. */
	finish: BatchRecorder['finish'];
	/** Coverage included. */
	gates: () => ReturnType<typeof runBatchGates>;
	/** Does not persist a report. */
	checkLive: BatchSiteChecker['checkLive'];
	remainingSiteKeys: BatchSiteChecker['remainingSiteKeys'];
	/** Reports only what the pre-edit review did not. */
	reviewOutput: (params: { baseline: StandardsFinding[] }) => ReturnType<typeof reviewBatchOutput>;
	settle: (params: { invokeFix: Parameters<typeof settleBatchGates>[0]['invokeFix'] }) => ReturnType<typeof settleBatchGates>;
	rationale: BatchRecorder['rationale'];
}
