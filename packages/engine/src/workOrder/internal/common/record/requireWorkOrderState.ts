import { describeMissingWorkOrder } from '#src/common/utils/describeMissingWorkOrder.ts';
import type { WorkOrderState } from '#src/contracts/workOrder/WorkOrderState.ts';

interface Params {
	record: WorkOrderState | undefined;
	name: string;
}

/**
 * A shipped record is history: any change could only re-open shipping or
 * misdescribe what shipped. `show` and `sync` never ask here, which keeps a
 * merged ticket readable.
 */
export const requireWorkOrderState = ({ record, name }: Params): WorkOrderState | { error: string } => {
	if (record === undefined) {
		return { error: describeMissingWorkOrder({ name }) };
	}

	return record.shipped === undefined
		? record
		: { error: `work order ${record.name} shipped as ${record.shipped.mergeCommit}, and a shipped work order's state is history that no longer changes` };
};
