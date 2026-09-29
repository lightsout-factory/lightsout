import type { RunState } from '#src/common/services/RunState.ts';
import type { RunStatus } from '#src/contracts/run/RunStatus.ts';
import type { StepRecord } from '#src/contracts/run/StepRecord.ts';
import type { PipelineResult } from '#src/pipeline/PipelineResult.ts';

interface Params {
	run: RunState;
	record: StepRecord;
	status: RunStatus;
	error: string;
}

export const stopDirectRun = async ({ run, record, status, error }: Params): Promise<PipelineResult> => {
	await run.stop({ record, status, error, label: 'direct run' });

	return { ok: false, manifest: run.current(), error };
};
