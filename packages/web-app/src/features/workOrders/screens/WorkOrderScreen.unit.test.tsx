import { describe, expect, test } from '@jest/globals';
import type { WorkOrderSummary, WorkOrderView } from '@lightsout/engine';
import {
	PlanProgress,
	RunStatus,
	ShipBlockReason,
	ShippingStepId,
	ShipStatus,
	WorkOrderEventKind,
	WorkOrderMode,
	WorkOrderStatus,
} from '@lightsout/engine/contracts';
import { createMemoryHistory, createRootRoute, createRouter, RouterProvider } from '@tanstack/react-router';
import { screen, within } from '@testing-library/react';
import { workOrderViewQueryOptions } from '#src/features/workOrders/queries/workOrderViewQueryOptions.ts';
import { WorkOrderScreen } from '#src/features/workOrders/screens/WorkOrderScreen.tsx';
import { renderWithQueryClient } from '#tests/helpers/renderWithQueryClient.tsx';

const name = 'search-work';

/** A multiple-plan work order with nothing shipped and no ship record — each test varies only what it reads. */
const buildView = ({ summary, ...overrides }: Partial<Omit<WorkOrderView, 'summary'>> & { summary?: Partial<WorkOrderSummary> } = {}): WorkOrderView => ({
	summary: {
		name,
		ticketRef: 'LO-42',
		branch: 'feature/search-basics',
		status: WorkOrderStatus.Building,
		plansDone: 1,
		plansTotal: 2,
		updatedAt: '2026-11-20T09:05:00.000Z',
		live: false,
		...summary,
	},
	mode: WorkOrderMode.MultiplePlan,
	plans: [],
	builtFromTicketBody: false,
	shipSteps: [],
	shipLive: false,
	history: [],
	...overrides,
});

/**
 * The screen under a memory-history router whose one route renders it, with
 * the cache already holding what the route's loader would have fetched, so no
 * server function is ever reached.
 */
const setupWorkOrderScreen = async ({ view = buildView() }: { view?: WorkOrderView } = {}) => {
	const rootRoute = createRootRoute({ component: () => <WorkOrderScreen name={view.summary.name} /> });
	const router = createRouter({ routeTree: rootRoute, history: createMemoryHistory({ initialEntries: ['/'] }) });

	await router.load();
	renderWithQueryClient({
		ui: <RouterProvider router={router} />,
		seed: [{ queryKey: workOrderViewQueryOptions({ name: view.summary.name }).queryKey, data: view }],
	});
	await screen.findByRole('heading', { level: 1, name: view.summary.name });
};

/** The titled `SiteSection` the screen draws under that heading. */
const sectionTitled = ({ title }: { title: string }): HTMLElement => {
	const section = screen.getByRole('heading', { level: 2, name: title }).closest('section');

	if (section === null) {
		throw new Error(`no section is titled ${title}`);
	}

	return section;
};

describe('WorkOrderScreen', () => {
	test.each([
		{ prUrl: 'https://github.com/acme/search/pull/7', expectedPrLinks: ['https://github.com/acme/search/pull/7'] },
		{ prUrl: undefined, expectedPrLinks: [] },
	])('heads the page with its ticket, branch, mode and pull request', async ({ prUrl, expectedPrLinks }) => {
		await setupWorkOrderScreen({ view: buildView({ summary: { prUrl } }) });

		const ticket = screen.getByText(/LO-42/);
		const branches = screen.queryAllByText(/feature\/search-basics/);
		const modes = screen.queryAllByText(/multiple/i);
		const prLinks = screen
			.queryAllByRole('link')
			.map((link) => link.getAttribute('href'))
			.filter((href) => href?.startsWith('https://'));

		expect({ ticketIsLink: ticket.closest('a') !== null, branchShown: branches.length > 0, modeShown: modes.length > 0, prLinks }).toStrictEqual({
			ticketIsLink: false,
			branchShown: true,
			modeShown: true,
			prLinks: expectedPrLinks,
		});
	});

	test('lists each plan linking to its page with its progress, an excluded plan marked excluded with its reason', async () => {
		await setupWorkOrderScreen({
			view: buildView({
				plans: [
					{ id: '001-search-basics', title: 'Search basics', progress: PlanProgress.Implemented },
					{
						id: '002-ranking',
						title: 'Ranking',
						progress: PlanProgress.Ready,
						exclusion: { at: '2026-11-19T10:00:00.000Z', reason: 'Out of scope for this ticket' },
					},
				],
			}),
		});
		const plans = sectionTitled({ title: 'Plans' });

		const hrefs = within(plans)
			.getAllByRole('link')
			.map((link) => link.getAttribute('href'));

		expect({ hrefs, text: plans.textContent }).toStrictEqual({
			hrefs: ['/app/work-orders/search-work/plans/001-search-basics', '/app/work-orders/search-work/plans/002-ranking'],
			text: expect.stringMatching(/Search basics.*implemented.*Ranking.*excluded.*Out of scope for this ticket/is),
		});
	});

	test('notes a work order built from the ticket body', async () => {
		await setupWorkOrderScreen({
			view: buildView({
				mode: WorkOrderMode.SinglePlan,
				builtFromTicketBody: true,
				ticketBodyBuild: { progress: PlanProgress.Implementing, startedAt: '2026-11-20T09:00:00.000Z' },
			}),
		});

		const plans = sectionTitled({ title: 'Plans' });

		expect(plans.textContent).toMatch(/ticket body/i);
	});

	test.each([
		{
			view: buildView({
				shipResult: {
					status: ShipStatus.Blocked,
					branch: 'feature/search-basics',
					reason: ShipBlockReason.ChecksTimedOut,
					detail: 'CI never settled on the pushed commit',
					failingChecks: ['unit-tests', 'typecheck'],
				},
				shipSteps: [
					{ id: ShippingStepId.Integrate, status: RunStatus.Passed, durationMs: 65_000 },
					{ id: ShippingStepId.Push, status: RunStatus.Passed, durationMs: 4_000 },
					{ id: ShippingStepId.PullRequest, status: RunStatus.Passed, durationMs: 2_000 },
					{ id: ShippingStepId.Checks, status: RunStatus.Failed, durationMs: undefined },
					{ id: ShippingStepId.Merge, status: undefined, durationMs: undefined },
					{ id: ShippingStepId.Sync, status: undefined, durationMs: undefined },
				],
			}),
			expected: [
				/integrate.*passed.*1m 05s.*push.*passed.*4s.*pull-request.*passed.*2s.*checks.*failed.*—.*merge.*not run.*—.*sync.*not run.*—/is,
				/checks.timed.out/i,
				/CI never settled on the pushed commit/,
				/unit-tests/,
				/typecheck/,
			],
		},
		{ view: buildView(), expected: [/Not shipped yet\./] },
	])("shows a blocked ship's reason and failing checks, and says when nothing has shipped", async ({ view, expected }) => {
		await setupWorkOrderScreen({ view });

		const text = sectionTitled({ title: 'Ship' }).textContent ?? '';

		expect(expected.filter((pattern) => !pattern.test(text))).toStrictEqual([]);
	});

	test('leaves the ticket out of the header when the work order carries none', async () => {
		await setupWorkOrderScreen({ view: buildView({ summary: { ticketRef: undefined } }) });

		const headerText = screen.getByRole('heading', { level: 1, name }).closest('header')?.textContent ?? '';

		expect({ branch: headerText.includes('feature/search-basics'), ticket: headerText.includes('LO-42') }).toStrictEqual({ branch: true, ticket: false });
	});

	test('notes a work order built from the ticket body before its build has started', async () => {
		await setupWorkOrderScreen({ view: buildView({ mode: WorkOrderMode.SinglePlan, builtFromTicketBody: true }) });

		const plans = sectionTitled({ title: 'Plans' });

		expect({ ticketBody: /ticket body/i.test(plans.textContent ?? ''), since: /since/i.test(plans.textContent ?? '') }).toStrictEqual({
			ticketBody: true,
			since: false,
		});
	});

	test('shows a shipped result with no reason, detail or failing checks, and does not say nothing has shipped', async () => {
		await setupWorkOrderScreen({
			view: buildView({ shipResult: { status: ShipStatus.Shipped, branch: 'feature/search-basics', failingChecks: [] } }),
		});

		const ship = sectionTitled({ title: 'Ship' });

		expect({ text: ship.textContent, lists: within(ship).queryAllByRole('list').length }).toStrictEqual({
			text: expect.stringMatching(/^Ship\s*Shipped$/),
			lists: 0,
		});
	});

	test('says a work order with no plans and no history has none yet', async () => {
		await setupWorkOrderScreen();

		const plans = sectionTitled({ title: 'Plans' });
		const history = sectionTitled({ title: 'History' });

		expect({ plans: plans.textContent, history: history.textContent }).toStrictEqual({
			plans: expect.stringMatching(/no plans yet/i),
			history: expect.stringMatching(/nothing recorded yet/i),
		});
	});

	test('lists the history in recorded order with local times', async () => {
		// Built from local wall-clock parts, so each instant reads the same local
		// time whatever time zone the suite runs in.
		await setupWorkOrderScreen({
			view: buildView({
				history: [
					{ at: new Date(2026, 10, 18, 9, 5).toISOString(), kind: WorkOrderEventKind.PlanAdded, detail: 'added plan 001-search-basics' },
					{ at: new Date(2026, 10, 19, 14, 30).toISOString(), kind: WorkOrderEventKind.PlanExcluded, detail: 'excluded plan 002-ranking' },
					{ at: new Date(2026, 10, 20, 8, 0).toISOString(), kind: WorkOrderEventKind.ShipRequested, detail: 'ship requested for 001-search-basics' },
				],
			}),
		});
		const history = sectionTitled({ title: 'History' });

		const items = within(history)
			.getAllByRole('listitem')
			.map((item) => item.textContent);

		expect(items).toStrictEqual([
			expect.stringMatching(/18 Nov 2026, 09:05.*added plan 001-search-basics/s),
			expect.stringMatching(/19 Nov 2026, 14:30.*excluded plan 002-ranking/s),
			expect.stringMatching(/20 Nov 2026, 08:00.*ship requested for 001-search-basics/s),
		]);
	});
});
