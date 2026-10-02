import type { WorkOrderShipStateKind } from '#src/workOrder/common/constants/WorkOrderShipStateKind.ts';

/** A multiple-plan record's ship request, measured against the plans the work order includes. */
export interface WorkOrderShipRequestedState {
	kind: typeof WorkOrderShipStateKind.ShipRequested;
	planIds: string[];
	includedPlanIds: string[];
	/** Included plans the request does not name. */
	missingPlanIds: string[];
	/** Plans the request names that the ticket no longer includes. */
	stalePlanIds: string[];
	/** The lowest included plan whose implementation has not finished. */
	waitingPlanId?: string;
}
