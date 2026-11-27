import { queryOptions } from '@tanstack/react-query';
import { getWorkOrderEvidenceServerFn } from '#src/features/workOrders/server/getWorkOrderEvidenceServerFn.ts';

interface Params {
	/** The folder's name under the work-orders directory. */
	name: string;
}

/** Never polled: the totals read every plan's evidence, so they are fetched once when the page opens. */
export const workOrderEvidenceQueryOptions = ({ name }: Params) =>
	queryOptions({ queryKey: ['workOrderEvidence', name], queryFn: () => getWorkOrderEvidenceServerFn({ data: { name } }) });
