import { runFormatter } from '#src/common/processes/runFormatter.ts';
import type { GateResult } from '#src/contracts/gates/GateResult.ts';
import { RunStatus } from '#src/contracts/run/RunStatus.ts';
import type { StepRecord } from '#src/contracts/run/StepRecord.ts';
import { reviewAndVerify } from '#src/pipeline/steps/verify/reviewAndVerify.ts';
import type { RepairOutcome } from '#src/pipeline/steps/verifyStep/internal/common/types/RepairOutcome.ts';
import type { VerifyContext } from '#src/pipeline/steps/verifyStep/internal/common/types/VerifyContext.ts';
import { verificationOf } from '#src/pipeline/steps/verifyStep/internal/common/utils/verificationOf.ts';

interface Params {
	context: VerifyContext;
	record: StepRecord;
}

/**
 * A formatter that fails is itself the verdict, under the `format` family: nothing is judged or
 * run on a tree it could not settle. A rate-limited review parks, because it said nothing about
 * the tests and left no verdict to repair.
 */
export const formatAndVerify = async ({ context, record }: Params): Promise<RepairOutcome> => {
	const { run, id, coverage, final, planContent, overviewContent, acceptanceTests, renames } = context;
	const failures: GateResult[] = [];
	const error = await runFormatter({
		cwd: run.cwd,
		runId: run.current().runId,
		config: run.config,
		step: id,
		onResult: (result) => failures.push(result),
	});
	const next = { ...record, verification: { ...verificationOf({ record }), needsFormatting: false } };

	await run.setStep({ record: next });

	if (error !== undefined) {
		return { record: next, result: { error, failedFamilies: ['format'], crashes: [], timeouts: [], coordination: undefined, failures, gates: [] } };
	}

	const result = await reviewAndVerify({ run, id, coverage, final, planContent, overviewContent, acceptanceTests, renames });

	if ('rateLimited' in result) {
		return { parked: await run.stop({ record: next, status: RunStatus.PausedRateLimit, error: run.parkMessage() }) };
	}

	return { record: next, result };
};
