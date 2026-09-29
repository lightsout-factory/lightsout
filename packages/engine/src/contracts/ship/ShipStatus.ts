/** Two values only: every "why not" is `ShipBlockReason`'s job. */
export const ShipStatus = {
	Shipped: 'shipped',
	Blocked: 'blocked',
} as const;

export type ShipStatus = (typeof ShipStatus)[keyof typeof ShipStatus];
