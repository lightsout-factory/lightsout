/** The key order is the board's column order: whatever draws the board reads its columns from here. */
export const QueueLane = {
	Parked: 'parked',
	Blocked: 'blocked',
	BuildQueue: 'build-queue',
	Building: 'building',
	ShipQueue: 'ship-queue',
	ShippingNow: 'shipping-now',
	Shipped: 'shipped',
} as const;

export type QueueLane = (typeof QueueLane)[keyof typeof QueueLane];
