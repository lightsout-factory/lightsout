import type { NamedWorkOrder } from '#src/queue/common/types/NamedWorkOrder.ts';

export interface BuildInFlight {
	workOrder: NamedWorkOrder;
	/** ISO time the builder picked the work order up. */
	startedAt: string;
}
