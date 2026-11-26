import { queryOptions } from '@tanstack/react-query';
import { getWorkOrderViewServerFn } from '#src/features/workOrders/server/getWorkOrderViewServerFn.ts';
import { pollWhileLive } from '#src/utils/pollWhileLive.ts';

interface Params {
	/** The folder's name under the work-orders directory. */
	name: string;
}

/** Polled only while the work order has a live process behind it. */
export const workOrderViewQueryOptions = ({ name }: Params) =>
	queryOptions({
		queryKey: ['workOrderView', name],
		queryFn: () => getWorkOrderViewServerFn({ data: { name } }),
		refetchInterval: (query) => pollWhileLive({ live: query.state.data?.summary.live === true }),
	});
