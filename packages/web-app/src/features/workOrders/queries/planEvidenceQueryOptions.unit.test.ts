import { describe, expect, jest, test } from '@jest/globals';
import { EvidenceProvenance, EvidenceSectionState, type PlanEvidence } from '@lightsout/engine';
import { planEvidenceQueryOptions } from '#src/features/workOrders/queries/planEvidenceQueryOptions.ts';

// Mocked Imports
// -------------------------
// The server function is the boundary: what it is asked for is the plan
// address this options factory spells.
const mockGetPlanEvidence = jest.fn<(params: { data: { name: string } }) => Promise<PlanEvidence>>();

jest.mock('#src/features/workOrders/server/getPlanEvidenceServerFn.ts', () => ({
	getPlanEvidenceServerFn: (params: { data: { name: string } }) => mockGetPlanEvidence(params),
}));
// -------------------------

const measured = (value: number) => ({ value, provenance: EvidenceProvenance.Measured });

const buildEvidence = ({ checksState }: { checksState: EvidenceSectionState }): PlanEvidence => ({
	name: 'lo-7-search-ranking/001-ranking',
	headline: {},
	plan: { state: EvidenceSectionState.Finished, gradePasses: [], findingsByStatus: [] },
	checks: {
		state: checksState,
		gateRuns: measured(4),
		failed: measured(1),
		fixed: measured(1),
		selfChecks: measured(2),
		repairs: [],
	},
	problems: [],
});

const setupPlanEvidenceQueryOptions = ({ data }: { data?: PlanEvidence } = {}) => {
	const fetched = buildEvidence({ checksState: EvidenceSectionState.Finished });
	mockGetPlanEvidence.mockResolvedValue(fetched);

	const options = planEvidenceQueryOptions({ workOrder: 'lo-7-search-ranking', plan: '001-ranking' });
	// Typed against TanStack's QueryFunctionContext and Query generics; the
	// fetcher takes no context and the interval reads nothing but the data.
	const fetchEvidence = options.queryFn as unknown as () => Promise<PlanEvidence>;
	const refetchInterval = options.refetchInterval as unknown as (query: { state: { data: PlanEvidence | undefined } }) => number | false;
	const query = { state: { data } };

	return { fetched, fetchEvidence, options, query, refetchInterval };
};

describe('planEvidenceQueryOptions', () => {
	test('keys the query by work order and plan and spells the address', async () => {
		const { fetched, fetchEvidence, options } = setupPlanEvidenceQueryOptions();

		const evidence = await fetchEvidence();

		expect({ queryKey: options.queryKey, evidence, asked: mockGetPlanEvidence.mock.calls }).toStrictEqual({
			queryKey: ['planEvidence', 'lo-7-search-ranking', '001-ranking'],
			evidence: fetched,
			asked: [[{ data: { name: 'lo-7-search-ranking/001-ranking' } }]],
		});
	});

	test.each([
		{ data: buildEvidence({ checksState: EvidenceSectionState.InProgress }), expected: 30_000 },
		{ data: buildEvidence({ checksState: EvidenceSectionState.Finished }), expected: false },
		{ data: undefined, expected: false },
	])('polls every thirty seconds while a section is in progress and never once all are finished', ({ data, expected }) => {
		const { query, refetchInterval } = setupPlanEvidenceQueryOptions({ data });

		const interval = refetchInterval(query);

		expect(interval).toBe(expected);
	});
});
