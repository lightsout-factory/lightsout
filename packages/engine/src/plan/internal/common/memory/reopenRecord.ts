import type { GradeFindingRecord } from '#src/contracts/plan/memory/GradeFindingRecord.ts';
import { GradeFindingStatus } from '#src/contracts/plan/memory/GradeFindingStatus.ts';

interface Params {
	record: GradeFindingRecord;
	reason: string;
	at: string;
}

/** Every reopen goes through here, because a copy that forgot to clear the citations would leave a closure nobody checks. */
export const reopenRecord = ({ record, reason, at }: Params): GradeFindingRecord => ({
	...record,
	status: GradeFindingStatus.Open,
	resolutions: [],
	lastSeen: at,
	reopened: [...record.reopened, { at, reason, priorStatus: record.status }],
});
