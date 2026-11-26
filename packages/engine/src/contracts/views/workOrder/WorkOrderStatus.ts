/**
 * Derived from the work-order record, its ship records and its plans'
 * progress, never stored, so it cannot go stale. The first that applies wins,
 * in member order from `Shipped` down.
 */
export const WorkOrderStatus = {
	/** Nothing has started building yet, or a counted plan is still being planned. */
	Planning: 'planning',
	/** A counted plan, or the build from the ticket body, is implementing. */
	Building: 'building',
	/** Every counted plan is implemented, or the build from the ticket body is. */
	ReadyToShip: 'ready-to-ship',
	/** A ship of the branch is going under a live process. */
	Shipping: 'shipping',
	/** The record says it shipped, or the last ship result does. */
	Shipped: 'shipped',
	/** The last ship stopped, a ship was left with no live process, or a counted plan or the ticket-body build failed. */
	Blocked: 'blocked',
} as const;

export type WorkOrderStatus = (typeof WorkOrderStatus)[keyof typeof WorkOrderStatus];
