import { RunStatus } from '#src/contracts/run/RunStatus.ts';
import type { StepRecord } from '#src/contracts/run/StepRecord.ts';
import type { WorkReport } from '#src/contracts/work/WorkReport.ts';
import type { PipelineRun } from '#src/pipeline/common/PipelineRun.ts';
import type { PipelineResult } from '#src/pipeline/PipelineResult.ts';

interface Params {
	run: PipelineRun;
	record: StepRecord;
	invocation: { systemPrompt: string; prompt: string };
	step: string;
}

export const invokeRoleOrStop = async ({ run, record, invocation, step }: Params): Promise<{ report: WorkReport } | { stopped: PipelineResult }> => {
	const outcome = await run.invokeRole({ invocation, step });

	if (!outcome.ok) {
		return outcome.rateLimited
			? { stopped: await run.stop({ record, status: RunStatus.PausedRateLimit, error: run.parkMessage() }) }
			: { stopped: await run.stop({ record, status: RunStatus.Failed, error: outcome.failure }) };
	}

	return { report: outcome.report };
};
