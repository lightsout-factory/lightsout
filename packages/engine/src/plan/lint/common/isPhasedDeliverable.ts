interface Params {
	hasOverview: boolean;
	/** The overview excluded. */
	implementableCount: number;
}

/**
 * Shared by the lint and the dedup precheck: two copies drifting would let one
 * plan file pass one and fail the other on the same bytes.
 */
export const isPhasedDeliverable = ({ hasOverview, implementableCount }: Params): boolean => hasOverview || implementableCount > 1;
