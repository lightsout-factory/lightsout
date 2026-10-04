import { WorkOrderEventKind } from '#src/contracts/workOrder/WorkOrderEventKind.ts';
import type { WorkOrderState } from '#src/contracts/workOrder/WorkOrderState.ts';
import { appendWorkOrderEvent } from '#src/workOrder/common/appendWorkOrderEvent.ts';

interface Params {
	record: WorkOrderState;
	/** The sentence the history keeps. */
	detail: string;
	at: string;
}

/** A record carrying no authorization comes back untouched, so callers call this unconditionally. */
export const recordHandBuiltShipAuthorizationWithdrawal = ({ record, detail, at }: Params): WorkOrderState =>
	record.handBuiltShipAuthorization === undefined
		? record
		: appendWorkOrderEvent({
				record: { ...record, handBuiltShipAuthorization: undefined },
				kind: WorkOrderEventKind.HandBuiltShipAuthorizationWithdrawn,
				detail,
				at,
			});
