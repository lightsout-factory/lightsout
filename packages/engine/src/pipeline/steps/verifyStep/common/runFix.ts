import { RunStatus } from '#src/contracts/run/RunStatus.ts';
import type { StepRecord } from '#src/contracts/run/StepRecord.ts';
import { WorkReportStatus } from '#src/contracts/work/WorkReportStatus.ts';
import { collectChanged } from '#src/pipeline/steps/common/collectChanged.ts';
import { formatAndVerify } from '#src/pipeline/steps/common/formatAndVerify.ts';
import type { RepairOutcome } from '#src/pipeline/steps/common/types/RepairOutcome.ts';
import type { VerifyContext } from '#src/pipeline/steps/common/types/VerifyContext.ts';
import { withStepFiles } from '#src/pipeline/steps/common/withStepFiles.ts';
import { appendFriction } from '#src/runState/friction/appendFriction.ts';

interface Params {
	context: VerifyContext;
	errorContext: string;
	record: StepRecord;
}

export const runFix = async ({ context, errorContext, record }: Params): Promise<RepairOutcome> => {
	const { run, gitPrefix, id } = context;
	const fix = await run.invokeRole({ invocation: context.buildFix({ errorContext }), step: id });

	if (!fix.ok && fix.rateLimited) {
		return { parked: await run.stop({ record, status: RunStatus.PausedRateLimit, error: run.parkMessage() }) };
	}

	let next = record;

	if (fix.ok) {
		const { report } = fix;

		await appendFriction({ cwd: run.cwd, runId: run.current().runId, step: id, friction: report.friction ?? [] });

		if (report.status === WorkReportStatus.Complete) {
			next = withStepFiles({ record, reports: [report], gitPrefix });
			await run.setStep({ record: { ...next, report }, patch: await collectChanged({ run, gitPrefix, reports: [report] }) });
		}
	}

	return formatAndVerify({ context, record: next });
};
