import { describe, expect, jest, test } from '@jest/globals';
import { WorkOrderEvidenceTotals } from '@lightsout/engine';
import { workOrderEvidenceQueryOptions } from '#src/features/workOrders/queries/workOrderEvidenceQueryOptions.ts';

// Mocked Imports
// -------------------------
// The server function is the boundary: what it is asked for is the work order
// name this options factory hands on.
const mockGetWorkOrderEvidence = jest.fn<(params: { data: { name: string } }) => Promise<WorkOrderEvidenceTotals>>();

jest.mock('#src/features/workOrders/server/getWorkOrderEvidenceServerFn.ts', () => ({
	getWorkOrderEvidenceServerFn: (params: { data: { name: string } }) => mockGetWorkOrderEvidence(params),
}));
// -------------------------

const setupWorkOrderEvidenceQueryOptions = () => {
	const fetched = WorkOrderEvidenceTotals.parse({
		headline: { startedAt: '2026-01-01T09:00:00.000Z' },
		plansCovered: 1,
		plansCounted: 2,
	});
	mockGetWorkOrderEvidence.mockResolvedValue(fetched);

	const options = workOrderEvidenceQueryOptions({ name: 'lo-7-search-ranking' });
	// Typed against TanStack's QueryFunctionContext generics; the fetcher takes no context.
	const fetchTotals = options.queryFn as unknown as () => Promise<WorkOrderEvidenceTotals>;

	return { fetched, fetchTotals, options };
};

describe('workOrderEvidenceQueryOptions', () => {
	test('keys the query by work order name and never polls', async () => {
		const { fetched, fetchTotals, options } = setupWorkOrderEvidenceQueryOptions();

		const totals = await fetchTotals();

		expect({ queryKey: options.queryKey, refetchInterval: options.refetchInterval, totals, asked: mockGetWorkOrderEvidence.mock.calls }).toStrictEqual({
			queryKey: ['workOrderEvidence', 'lo-7-search-ranking'],
			refetchInterval: undefined,
			totals: fetched,
			asked: [[{ data: { name: 'lo-7-search-ranking' } }]],
		});
	});
});
