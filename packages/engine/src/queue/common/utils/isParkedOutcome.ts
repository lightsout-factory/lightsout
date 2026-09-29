import type { WorkOrderRunOutcome } from '#src/queue/common/types/WorkOrderRunOutcome.ts';

interface Params {
	outcome: WorkOrderRunOutcome;
}

// One place, so the parked label, the coordinator status and the exit code
// never disagree about a ticket left open.
export const isParkedOutcome = ({ outcome }: Params): boolean => !outcome.ready && outcome.open === undefined;
