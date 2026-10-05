import type { LeftBehindTicket } from '#src/common/types/LeftBehindTicket.ts';
import type { WorkOrderRunOutcome } from '#src/common/types/WorkOrderRunOutcome.ts';
import type { BuildInFlight } from '#src/queue/common/types/BuildInFlight.ts';
import type { NamedWorkOrder } from '#src/queue/common/types/NamedWorkOrder.ts';

export interface QueueBoardLanes {
	/** Admitted, no builder yet, in pick-up order. */
	pending: NamedWorkOrder[];
	/** Builds in flight, in start order. */
	building: BuildInFlight[];
	/** Built and waiting for the ship lane, oldest-ready first. */
	readyToShip: WorkOrderRunOutcome[];
	shipping: WorkOrderRunOutcome | undefined;
	/** Held back by an unfinished blocker or a gate hold, and not yet settled, in first-held order. */
	blocked: LeftBehindTicket[];
}
