/**
 * The history is append-only so a withdrawal stays readable: a withdrawn ship
 * request leaves both `ShipRequested` and `ShipRequestWithdrawn`.
 */
export const WorkOrderEventKind = {
	PlanAdded: 'plan-added',
	PlanRetitled: 'plan-retitled',
	PlanExcluded: 'plan-excluded',
	ModeChanged: 'mode-changed',
	ShipRequested: 'ship-requested',
	ShipRequestWithdrawn: 'ship-request-withdrawn',
	Shipped: 'shipped',
} as const;

export type WorkOrderEventKind = (typeof WorkOrderEventKind)[keyof typeof WorkOrderEventKind];
