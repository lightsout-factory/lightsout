import { WorkOrderEventKind } from '#src/contracts/workOrder/WorkOrderEventKind.ts';
import type { WorkOrderState } from '#src/contracts/workOrder/WorkOrderState.ts';
import { appendWorkOrderEvent } from '#src/workOrder/common/appendWorkOrderEvent.ts';

interface Params {
	record: WorkOrderState;
	/** The sentence the history keeps. */
	detail: string;
	at: string;
}

/** A record carrying no request comes back untouched, so callers call this unconditionally. */
export const recordShipRequestWithdrawal = ({ record, detail, at }: Params): WorkOrderState =>
	record.shipRequest === undefined
		? record
		: appendWorkOrderEvent({ record: { ...record, shipRequest: undefined }, kind: WorkOrderEventKind.ShipRequestWithdrawn, detail, at });
