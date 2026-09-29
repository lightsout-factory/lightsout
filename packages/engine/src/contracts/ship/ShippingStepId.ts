/** The key order is the order the shipping block draws its rows in, whatever the record holds. */
export const ShippingStepId = {
	Integrate: 'integrate',
	Push: 'push',
	PullRequest: 'pull-request',
	Checks: 'checks',
	Merge: 'merge',
	Sync: 'sync',
} as const;

export type ShippingStepId = (typeof ShippingStepId)[keyof typeof ShippingStepId];
