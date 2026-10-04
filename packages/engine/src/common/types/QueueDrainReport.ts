import type { LeftBehindTicket } from '#src/common/types/LeftBehindTicket.ts';
import type { WorkOrderRunOutcome } from '#src/common/types/WorkOrderRunOutcome.ts';

// `leftBehind` holds tickets the drain deliberately did not run, which never
// became outcomes but must never vanish from the summary.
export interface QueueDrainReport {
	outcomes: WorkOrderRunOutcome[];
	leftBehind: LeftBehindTicket[];
}
