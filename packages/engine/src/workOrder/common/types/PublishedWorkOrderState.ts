import type { WorkOrderState } from '#src/contracts/workOrder/WorkOrderState.ts';

export interface PublishedWorkOrderState {
	record: WorkOrderState;
	/** Normalised bytes, never the text as attached, so equal content always hashes equally. */
	content: Buffer;
}
