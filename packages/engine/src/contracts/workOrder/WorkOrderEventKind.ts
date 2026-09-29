/**
 * What one entry of a ticket record's append-only history records.
 *
 * The history is what makes a withdrawal or a supersession readable after the
 * fact: a ship request that a newly added plan withdrew leaves both the
 * `ShipRequested` and the `ShipRequestWithdrawn` event, rather than one silent
 * replacement.
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
