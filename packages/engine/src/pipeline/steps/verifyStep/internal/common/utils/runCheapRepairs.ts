import { maxCheapFixRetries } from '#src/common/constants/maxCheapFixRetries.ts';
import type { StepRecord } from '#src/contracts/run/StepRecord.ts';
import type { VerificationResult } from '#src/pipeline/internal/common/types/VerificationResult.ts';
import type { RepairOutcome } from '#src/pipeline/steps/verifyStep/internal/common/types/RepairOutcome.ts';
import type { VerifyContext } from '#src/pipeline/steps/verifyStep/internal/common/types/VerifyContext.ts';
import { runFix } from '#src/pipeline/steps/verifyStep/internal/common/utils/runFix.ts';
import { verificationOf } from '#src/pipeline/steps/verifyStep/internal/common/utils/verificationOf.ts';
import { withResult } from '#src/pipeline/steps/verifyStep/internal/common/utils/withResult.ts';

interface Params {
	context: VerifyContext;
	record: StepRecord;
	result: VerificationResult;
}

export const runCheapRepairs = async ({ context, record, result }: Params): Promise<RepairOutcome> => {
	let currentRecord = record;
	let currentResult = result;

	// A crash, a timeout or a gate run that never got the machine ends the loop, even beside a failed
	// family: the run then holds no whole verdict to repair against.
	while (currentResult.error && currentResult.crashes.length === 0 && currentResult.timeouts.length === 0 && currentResult.coordination === undefined) {
		const repairable = [...new Set(currentResult.failedFamilies)].filter(
			(family) => (currentRecord.verification?.repairAttempts[family] ?? 0) < maxCheapFixRetries,
		);

		if (repairable.length === 0) {
			break;
		}

		const repairAttempts = { ...currentRecord.verification?.repairAttempts };

		for (const family of repairable) {
			repairAttempts[family] = (repairAttempts[family] ?? 0) + 1;
		}

		currentRecord = {
			...currentRecord,
			attempts: currentRecord.attempts + 1,
			verification: { ...verificationOf({ record: currentRecord }), repairAttempts, needsFormatting: true },
		};
		await context.run.setStep({ record: currentRecord });
		context.run.progress(`step ${context.id}: gate red — repairing ${repairable.join(', ')}`);

		const fixed = await runFix({ context, errorContext: currentResult.error, record: currentRecord });

		if ('parked' in fixed) {
			return { parked: fixed.parked };
		}

		currentRecord = withResult({ record: fixed.record, result: fixed.result });
		currentResult = fixed.result;
		await context.run.setStep({ record: currentRecord });
	}

	return { record: currentRecord, result: currentResult };
};
