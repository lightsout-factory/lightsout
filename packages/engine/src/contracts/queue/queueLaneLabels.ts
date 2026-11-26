import { QueueLane } from '#src/contracts/queue/QueueLane.ts';

/**
 * The title every board draws for each lane, so the terminal and the web app
 * name a lane the same way. Keyed by `QueueLane` rather than `string`, so a new
 * lane fails the typecheck here instead of drawing a blank title.
 */
export const queueLaneLabels: Record<QueueLane, string> = {
	[QueueLane.Parked]: 'Parked',
	[QueueLane.Blocked]: 'Blocked',
	[QueueLane.BuildQueue]: 'Build Queue',
	[QueueLane.Building]: 'Building',
	[QueueLane.ShipQueue]: 'Ship Queue',
	[QueueLane.ShippingNow]: 'Shipping Now',
	[QueueLane.Shipped]: 'Shipped',
};
