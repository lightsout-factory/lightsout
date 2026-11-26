import { describe, expect, test } from '@jest/globals';
import { WorkOrderStatus, type WorkOrderSummary } from '@lightsout/engine';
import { workOrderSummariesQueryOptions } from '#src/features/workOrders/queries/workOrderSummariesQueryOptions.ts';

const summary = ({ name, live }: { name: string; live: boolean }): WorkOrderSummary => ({
	name,
	ticketRef: 'LO-13',
	branch: `${name}-branch`,
	status: WorkOrderStatus.Building,
	plansDone: 1,
	plansTotal: 2,
	updatedAt: '2026-11-26T10:00:00.000Z',
	live,
});

// No mocks: the fetcher is never called here, only the key and the polling
// rule the options object carries.
const setupWorkOrderSummariesQueryOptions = ({ data }: { data: WorkOrderSummary[] | undefined }) => {
	const options = workOrderSummariesQueryOptions();
	// TanStack types the interval against its own Query generic; the rule reads
	// nothing but the cached data, so only that is handed in.
	const refetchInterval = options.refetchInterval as unknown as (query: { state: { data: WorkOrderSummary[] | undefined } }) => number | false;
	const query = { state: { data } };

	return { options, refetchInterval, query };
};

describe('workOrderSummariesQueryOptions', () => {
	test.each([
		{
			data: [summary({ name: 'lo-12-idle', live: false }), summary({ name: 'lo-13-building', live: true })],
			expected: 5000,
		},
		{ data: [summary({ name: 'lo-12-idle', live: false })], expected: false },
		{ data: [], expected: false },
		{ data: undefined, expected: false },
	])('keys the cache under the summaries alone and polls only while a listed work order is live', ({ data, expected }) => {
		const { options, refetchInterval, query } = setupWorkOrderSummariesQueryOptions({ data });

		const interval = refetchInterval(query);

		expect({ queryKey: options.queryKey, interval }).toStrictEqual({ queryKey: ['workOrderSummaries'], interval: expected });
	});
});
