import { queryOptions } from '@tanstack/react-query';
import { listWorkOrderSummariesServerFn } from '#src/features/workOrders/server/listWorkOrderSummariesServerFn.ts';
import { pollWhileLive } from '#src/utils/pollWhileLive.ts';

/** Polled only while a listed work order has a live process behind it. */
export const workOrderSummariesQueryOptions = () =>
	queryOptions({
		queryKey: ['workOrderSummaries'],
		queryFn: () => listWorkOrderSummariesServerFn(),
		refetchInterval: (query) => pollWhileLive({ live: query.state.data?.some((row) => row.live) === true }),
	});
