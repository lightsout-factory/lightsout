import { describe, expect, jest, test } from '@jest/globals';
import { PlanWorkspaceView, type QueueView, type WorkOrderSummary, type WorkOrderView } from '@lightsout/engine';
import { PlanProgress, WorkOrderEventKind, WorkOrderMode, WorkOrderStatus } from '@lightsout/engine/contracts';
import { QueryClient } from '@tanstack/react-query';
import { createRouter } from '@tanstack/react-router';
import { screen } from '@testing-library/react';
import type { ComponentType, ReactNode } from 'react';
import { queueViewQueryOptions } from '#src/features/queue/queries/queueViewQueryOptions.ts';
import { planWorkspaceQueryOptions } from '#src/features/workOrders/queries/planWorkspaceQueryOptions.ts';
import { workOrderSummariesQueryOptions } from '#src/features/workOrders/queries/workOrderSummariesQueryOptions.ts';
import { workOrderViewQueryOptions } from '#src/features/workOrders/queries/workOrderViewQueryOptions.ts';
import { routeTree } from '#src/routeTree.gen.ts';
import { renderWithQueryClient } from '#tests/helpers/renderWithQueryClient.tsx';

// Mocked Imports
// -------------------------
// The server functions the app routes load through, so this file states its own
// work order, plan and queue rather than reading whatever a repo on disk holds.
const mockListWorkOrderSummaries = jest.fn<() => Promise<WorkOrderSummary[]>>();

jest.mock('#src/features/workOrders/server/listWorkOrderSummariesServerFn.ts', () => ({
	listWorkOrderSummariesServerFn: () => mockListWorkOrderSummaries(),
}));
// -------------------------
const mockGetWorkOrderView = jest.fn<(params: { data: { name: string } }) => Promise<WorkOrderView>>();

jest.mock('#src/features/workOrders/server/getWorkOrderViewServerFn.ts', () => ({
	getWorkOrderViewServerFn: (params: { data: { name: string } }) => mockGetWorkOrderView(params),
}));
// -------------------------
const mockGetPlanWorkspace = jest.fn<(params: { data: { name: string } }) => Promise<PlanWorkspaceView>>();

jest.mock('#src/features/workOrders/server/getPlanWorkspaceServerFn.ts', () => ({
	getPlanWorkspaceServerFn: (params: { data: { name: string } }) => mockGetPlanWorkspace(params),
}));
// -------------------------
const mockGetQueueView = jest.fn<() => Promise<QueueView>>();

jest.mock('#src/features/queue/server/getQueueViewServerFn.ts', () => ({
	getQueueViewServerFn: () => mockGetQueueView(),
}));
// -------------------------
// Only the piece that needs a live router around it is stood in for, so one
// route's component can be rendered on its own. Everything else — above all
// `createRouter` and the `createFileRoute` calls the tree is assembled from —
// stays real, since the tree is what is under test here.
jest.mock('@tanstack/react-router', () => {
	const actual = jest.requireActual<typeof import('@tanstack/react-router')>('@tanstack/react-router');

	return {
		...actual,
		Link: ({ to, params, children, className }: { to: string; params?: Record<string, string>; children: ReactNode; className?: string }) => (
			<a href={Object.entries(params ?? {}).reduce((path, [name, value]) => path.replace(`$${name}`, value), to)} className={className}>
				{children}
			</a>
		),
	};
});
// -------------------------

/**
 * One of the app's file routes, narrowed to what this file reads.
 *
 * The router types these against its own deeply generic route shapes; restating
 * those here would be noise rather than safety, so each entry names only the
 * argument the app's own code passes it and the value it hands back. Params are
 * stated loosely because the four routes carry different ones.
 */
interface FilePage {
	options: {
		component: ComponentType;
		loader: (input: { context: { queryClient: QueryClient }; params: Record<string, string> }) => Promise<void>;
		head: (input: { params: Record<string, string> }) => { meta: { title: string }[] };
	};
	useParams: () => Record<string, string>;
}

const workOrderName = 'lo-7-search-ranking';
const planId = '001-ranking';

const summary: WorkOrderSummary = {
	name: workOrderName,
	ticketRef: 'LO-7',
	branch: workOrderName,
	status: WorkOrderStatus.Building,
	plansDone: 0,
	plansTotal: 1,
	updatedAt: '2026-01-01T00:05:00.000Z',
	live: false,
};

const workOrderView: WorkOrderView = {
	summary,
	mode: WorkOrderMode.SinglePlan,
	plans: [{ id: planId, title: 'Rank by recency', progress: PlanProgress.Implementing }],
	builtFromTicketBody: false,
	shipSteps: [],
	shipLive: false,
	history: [{ at: '2026-01-01T00:00:00.000Z', kind: WorkOrderEventKind.PlanAdded, detail: 'added plan 001-ranking' }],
};

const workspace: PlanWorkspaceView = PlanWorkspaceView.parse({
	listing: {
		name: `${workOrderName}/${planId}`,
		stage: 'drafted',
		hasNotes: false,
		hasPlanFile: true,
		implementedFiles: [],
		phased: false,
		phaseCount: 0,
		updatedAt: '2026-01-01T00:05:00.000Z',
		runCount: 0,
	},
	rootPath: `/repos/app/.lightsout/work-orders/${workOrderName}/plans/${planId}`,
});

const queueView: QueueView = { drain: undefined };

const setupAppRoute = ({ id }: { id: string }) => {
	mockListWorkOrderSummaries.mockResolvedValue([summary]);
	mockGetWorkOrderView.mockResolvedValue(workOrderView);
	mockGetPlanWorkspace.mockResolvedValue(workspace);
	mockGetQueueView.mockResolvedValue(queueView);

	const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
	const router = createRouter({ routeTree, context: { queryClient } });
	const route = (router as unknown as { routesById: Record<string, FilePage> }).routesById[id];

	return { queryClient, route };
};

/**
 * One app route's page, rendered for the params it is given.
 *
 * `Route.useParams()` reads the match a live router is showing, so the params
 * come from a spy on that one method rather than from a router driven to the
 * path — which is the routing library's behaviour, not this route's. Every
 * query the three screens read is seeded, as each route's loader would have
 * filled it, so no server function is called.
 */
const setupAppPage = ({ id, params }: { id: string; params: Record<string, string> }) => {
	const { route } = setupAppRoute({ id });
	jest.spyOn(route, 'useParams').mockReturnValue(params);
	const Page = route.options.component;

	renderWithQueryClient({
		ui: <Page />,
		seed: [
			{ queryKey: workOrderViewQueryOptions({ name: workOrderName }).queryKey, data: workOrderView },
			{ queryKey: planWorkspaceQueryOptions({ workOrder: workOrderName, plan: planId }).queryKey, data: workspace },
			{ queryKey: queueViewQueryOptions().queryKey, data: queueView },
		],
	});
};

// The tree this file drives lives in `routeTree.gen.ts`, which TanStack Router
// writes and the repo lists as generated output — so it is not a subject a test
// may be named after. `router.tsx` is the tree's only consumer, which makes this
// a scenario suite on the router: what the local app's routes load and render,
// as opposed to the frame and gate the frames suite carries.
describe('routeTree app routes', () => {
	test('the work orders route loads the summaries before first paint', async () => {
		const { queryClient, route } = setupAppRoute({ id: '/app/' });

		await route.options.loader({ context: { queryClient }, params: {} });

		expect(queryClient.getQueryData(workOrderSummariesQueryOptions().queryKey)).toStrictEqual([summary]);
	});

	test('the work order route loads its view and titles the tab after the work order', async () => {
		const { queryClient, route } = setupAppRoute({ id: '/app/work-orders/$workOrder/' });

		await route.options.loader({ context: { queryClient }, params: { workOrder: workOrderName } });
		const head = route.options.head({ params: { workOrder: workOrderName } });

		expect({
			cached: queryClient.getQueryData(workOrderViewQueryOptions({ name: workOrderName }).queryKey),
			asked: mockGetWorkOrderView.mock.calls,
			meta: head.meta,
		}).toStrictEqual({
			cached: workOrderView,
			asked: [[{ data: { name: 'lo-7-search-ranking' } }]],
			meta: [{ title: 'lo-7-search-ranking — Work orders' }],
		});
	});

	test('the plan route loads its workspace and titles the tab after the plan', async () => {
		const { queryClient, route } = setupAppRoute({ id: '/app/work-orders/$workOrder/plans/$plan' });

		await route.options.loader({ context: { queryClient }, params: { workOrder: workOrderName, plan: planId } });
		const head = route.options.head({ params: { workOrder: workOrderName, plan: planId } });

		expect({
			cached: queryClient.getQueryData(planWorkspaceQueryOptions({ workOrder: workOrderName, plan: planId }).queryKey),
			asked: mockGetPlanWorkspace.mock.calls,
			meta: head.meta,
		}).toStrictEqual({
			cached: workspace,
			asked: [[{ data: { name: 'lo-7-search-ranking/001-ranking' } }]],
			meta: [{ title: '001-ranking — lo-7-search-ranking' }],
		});
	});

	test('the queue route loads the queue view and titles the tab Queue', async () => {
		const { queryClient, route } = setupAppRoute({ id: '/app/queue' });

		await route.options.loader({ context: { queryClient }, params: {} });
		const head = route.options.head({ params: {} });

		expect({ cached: queryClient.getQueryData(queueViewQueryOptions().queryKey), meta: head.meta }).toStrictEqual({
			cached: queueView,
			meta: [{ title: 'Queue' }],
		});
	});

	test('each app route renders its screen for its params', () => {
		setupAppPage({ id: '/app/work-orders/$workOrder/', params: { workOrder: workOrderName } });
		setupAppPage({ id: '/app/work-orders/$workOrder/plans/$plan', params: { workOrder: workOrderName, plan: planId } });
		setupAppPage({ id: '/app/queue', params: {} });

		const titles = screen.getAllByRole('heading', { level: 1 }).map((heading) => heading.textContent);

		expect(titles).toStrictEqual(['lo-7-search-ranking', '001-ranking', 'Queue']);
	});
});
