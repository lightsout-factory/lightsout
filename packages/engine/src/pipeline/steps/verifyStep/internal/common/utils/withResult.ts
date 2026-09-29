import type { StepRecord } from '#src/contracts/run/StepRecord.ts';
import type { VerificationResult } from '#src/pipeline/internal/common/types/VerificationResult.ts';
import { verificationOf } from '#src/pipeline/steps/verifyStep/internal/common/utils/verificationOf.ts';

interface Params {
	record: StepRecord;
	result: VerificationResult;
}

export const withResult = ({ record, result }: Params): StepRecord => ({
	...record,
	verification: {
		...verificationOf({ record }),
		failedFamilies: result.failedFamilies,
		failures: result.failures,
	},
});
