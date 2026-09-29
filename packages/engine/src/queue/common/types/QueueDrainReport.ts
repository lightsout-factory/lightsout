import type { WorkOrderRunOutcome } from '#src/queue/common/types/WorkOrderRunOutcome.ts';
import type { LeftBehindTicket } from '#src/queue/internal/common/types/LeftBehindTicket.ts';

// `leftBehind` holds tickets the drain deliberately did not run, which never
// became outcomes but must never vanish from the summary.
export interface QueueDrainReport {
	outcomes: WorkOrderRunOutcome[];
	leftBehind: LeftBehindTicket[];
}
