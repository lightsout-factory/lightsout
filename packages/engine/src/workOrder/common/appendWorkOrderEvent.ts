import type { WorkOrderEventKind } from '#src/contracts/workOrder/WorkOrderEventKind.ts';
import type { WorkOrderState } from '#src/contracts/workOrder/WorkOrderState.ts';

interface Params {
	record: WorkOrderState;
	kind: WorkOrderEventKind;
	detail: string;
	/** ISO timestamp. */
	at: string;
}

/** The only writer of a ticket's history, so the append-only rule holds by construction. */
export const appendWorkOrderEvent = ({ record, kind, detail, at }: Params): WorkOrderState => ({
	...record,
	history: [...record.history, { at, kind, detail }],
});
