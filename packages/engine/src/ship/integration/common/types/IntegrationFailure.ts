import type { ShipBlockReason } from '#src/contracts/ship/ShipBlockReason.ts';

export interface IntegrationFailure {
	reason: ShipBlockReason;
	detail: string;
	/** Conflicted paths, or the gate families that stayed red — whichever ended the recovery. Empty when neither applies. */
	paths: string[];
}
