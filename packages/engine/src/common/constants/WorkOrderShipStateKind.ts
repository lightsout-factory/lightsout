/** What a work order's record says its shipping waits for, one member per line `lightsout work-order show` prints. */
export const WorkOrderShipStateKind = {
	Shipped: 'shipped',
	ShipRequestMissing: 'ship-request-missing',
	ShipRequested: 'ship-requested',
	PlanOneWaiting: 'plan-one-waiting',
	PlanOneImplemented: 'plan-one-implemented',
	PlanOneExcluded: 'plan-one-excluded',
	TicketBodyUnbuilt: 'ticket-body-unbuilt',
	TicketBodyBuilding: 'ticket-body-building',
	TicketBodyFailed: 'ticket-body-failed',
	TicketBodyPassed: 'ticket-body-passed',
	HandBuiltAuthorized: 'hand-built-authorized',
} as const;

export type WorkOrderShipStateKind = (typeof WorkOrderShipStateKind)[keyof typeof WorkOrderShipStateKind];
