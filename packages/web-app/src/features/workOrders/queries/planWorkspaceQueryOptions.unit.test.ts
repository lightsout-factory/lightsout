import { describe, expect, jest, test } from '@jest/globals';
import { PlanWorkspaceView, RunStatus } from '@lightsout/engine';
import { planWorkspaceQueryOptions } from '#src/features/workOrders/queries/planWorkspaceQueryOptions.ts';

// Mocked Imports
// -------------------------
// The server function is the boundary: what it is asked for is the plan
// address this options factory is the one place to spell.
const mockGetPlanWorkspace = jest.fn<(params: { data: { name: string } }) => Promise<PlanWorkspaceView>>();

jest.mock('#src/features/workOrders/server/getPlanWorkspaceServerFn.ts', () => ({
	getPlanWorkspaceServerFn: (params: { data: { name: string } }) => mockGetPlanWorkspace(params),
}));
// -------------------------

const buildRun = ({ live }: { live: boolean }) => ({
	runId: 'a1b2c3d4-0000-0000-0000-000000000000',
	shortId: 'a1b2c3d4',
	pipeline: 'implement',
	status: live ? RunStatus.Running : RunStatus.Passed,
	title: 'Rank by recency',
	plan: '.lightsout/work-orders/lo-7-search-ranking/plans/001-ranking/plan.md',
	createdAt: '2026-01-01T00:00:00.000Z',
	updatedAt: '2026-01-01T00:05:00.000Z',
	live,
	packages: [],
	stepsPassed: 0,
	stepCount: 3,
	changedFileCount: 0,
	resumable: false,
});

const buildWorkspace = ({ planningLive, runs }: { planningLive: boolean; runs: ReturnType<typeof buildRun>[] }): PlanWorkspaceView =>
	PlanWorkspaceView.parse({
		listing: {
			name: 'lo-7-search-ranking/001-ranking',
			stage: 'drafted',
			hasNotes: false,
			hasPlanFile: true,
			implementedFiles: [],
			phased: false,
			phaseCount: 0,
			updatedAt: '2026-01-01T00:05:00.000Z',
			runCount: runs.length,
		},
		rootPath: '/repos/app/.lightsout/work-orders/lo-7-search-ranking/plans/001-ranking',
		planningLive,
		runs,
	});

const setupPlanWorkspaceQueryOptions = () => {
	const fetched = buildWorkspace({ planningLive: false, runs: [] });
	mockGetPlanWorkspace.mockResolvedValue(fetched);

	const options = planWorkspaceQueryOptions({ workOrder: 'lo-7-search-ranking', plan: '001-ranking' });
	// Typed against TanStack's QueryFunctionContext and Query generics; the
	// fetcher takes no context and the interval reads nothing but the data.
	const fetchWorkspace = options.queryFn as unknown as () => Promise<PlanWorkspaceView>;
	const intervalFor = options.refetchInterval as unknown as (query: { state: { data: PlanWorkspaceView | undefined } }) => number | false;
	const states = {
		notLoaded: undefined,
		planningLive: buildWorkspace({ planningLive: true, runs: [buildRun({ live: false })] }),
		runLive: buildWorkspace({ planningLive: false, runs: [buildRun({ live: false }), buildRun({ live: true })] }),
		idle: buildWorkspace({ planningLive: false, runs: [buildRun({ live: false })] }),
	};

	return { fetched, fetchWorkspace, intervalFor, options, states };
};

describe('planWorkspaceQueryOptions', () => {
	test('keys the cache by work order and plan, asks for their address, and polls only while planning or a run is live', async () => {
		const { fetched, fetchWorkspace, intervalFor, options, states } = setupPlanWorkspaceQueryOptions();

		const workspace = await fetchWorkspace();
		const intervals = Object.fromEntries(Object.entries(states).map(([state, data]) => [state, intervalFor({ state: { data } })]));

		expect({ queryKey: options.queryKey, workspace, asked: mockGetPlanWorkspace.mock.calls, intervals }).toStrictEqual({
			queryKey: ['planWorkspace', 'lo-7-search-ranking', '001-ranking'],
			workspace: fetched,
			asked: [[{ data: { name: 'lo-7-search-ranking/001-ranking' } }]],
			intervals: { notLoaded: false, planningLive: 5000, runLive: 5000, idle: false },
		});
	});
});
