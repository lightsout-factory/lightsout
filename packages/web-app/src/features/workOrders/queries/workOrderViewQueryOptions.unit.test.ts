import { describe, expect, test } from '@jest/globals';
import { workOrderViewQueryOptions } from '#src/features/workOrders/queries/workOrderViewQueryOptions.ts';

// The slice of TanStack's Query the interval reads: the cached view, if any.
interface PolledQuery {
	state: { data?: { summary: { live: boolean } } };
}

// No mocks: the fetcher is never called here, and the interval reads only the
// query handed to it.
const setupWorkOrderViewQueryOptions = () => {
	const options = workOrderViewQueryOptions({ name: 'lo-13-rebuild-app' });
	// Typed against TanStack's Query generics, of which the interval reads only
	// the cached data.
	const refetchInterval = options.refetchInterval as unknown as (query: PolledQuery) => number | false;
	const liveQuery: PolledQuery = { state: { data: { summary: { live: true } } } };
	const idleQuery: PolledQuery = { state: { data: { summary: { live: false } } } };
	const unloadedQuery: PolledQuery = { state: {} };

	return { idleQuery, liveQuery, options, refetchInterval, unloadedQuery };
};

describe('workOrderViewQueryOptions', () => {
	test('keys the cache by work order name and polls only while the work order is live', () => {
		const { idleQuery, liveQuery, options, refetchInterval, unloadedQuery } = setupWorkOrderViewQueryOptions();

		const whileLive = refetchInterval(liveQuery);
		const whileIdle = refetchInterval(idleQuery);
		const beforeLoad = refetchInterval(unloadedQuery);

		expect({ queryKey: options.queryKey, whileLive, whileIdle, beforeLoad }).toStrictEqual({
			queryKey: ['workOrderView', 'lo-13-rebuild-app'],
			whileLive: 5000,
			whileIdle: false,
			beforeLoad: false,
		});
	});
});
