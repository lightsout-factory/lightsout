import { canonicalJson } from '#src/common/canonicalJson.ts';
import type { WorkOrderState } from '#src/contracts/workOrder/WorkOrderState.ts';

interface Params {
	record: WorkOrderState;
}

/**
 * Every writer and hasher goes through here, so the same record built on two
 * machines produces identical bytes and can be compared by hash. The re-parse
 * carries `canonicalJson`'s key order into `JSON.stringify`'s indenting.
 */
export const serializeWorkOrderState = ({ record }: Params): Buffer => {
	const sorted: unknown = JSON.parse(canonicalJson({ value: record }));

	return Buffer.from(`${JSON.stringify(sorted, undefined, '\t')}\n`, 'utf8');
};
