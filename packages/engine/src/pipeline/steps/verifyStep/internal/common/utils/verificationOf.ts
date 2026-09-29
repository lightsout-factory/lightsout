import type { StepRecord } from '#src/contracts/run/StepRecord.ts';

interface Params {
	record: StepRecord;
}

export const verificationOf = ({ record }: Params): NonNullable<StepRecord['verification']> =>
	record.verification ?? {
		failedFamilies: [],
		repairAttempts: {},
		failures: [],
		needsFormatting: false,
		guidedRepairAttempted: false,
	};
