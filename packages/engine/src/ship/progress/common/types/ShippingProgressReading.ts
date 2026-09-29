import type { ShippingProgress } from '#src/contracts/ship/ShippingProgress.ts';

/**
 * A missing record and an unreadable one are told apart, because the shipping
 * block draws a missing record as every step not reached and names an unreadable one.
 */
export interface ShippingProgressReading {
	/** Set whether or not a file is there; undefined when no work order claims the branch. */
	path: string | undefined;
	exists: boolean;
	/** Undefined when the file is absent, unreadable or off-contract. */
	progress: ShippingProgress | undefined;
}
