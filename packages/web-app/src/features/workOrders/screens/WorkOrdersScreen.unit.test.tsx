import { describe, expect, test } from '@jest/globals';
import { WorkOrderStatus, type WorkOrderSummary } from '@lightsout/engine';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryHistory, createRootRoute, createRoute, createRouter, RouterProvider } from '@tanstack/react-router';
import { render, screen } from '@testing-library/react';
import { workOrderSummariesQueryOptions } from '#src/features/workOrders/queries/workOrderSummariesQueryOptions.ts';
import { WorkOrdersScreen } from '#src/features/workOrders/screens/WorkOrdersScreen.tsx';

/** A local wall-clock instant, so the time a row prints reads the same in any time zone the suite runs in. */
const updatedAt = new Date(2026, 2, 7, 9, 5).toISOString();

const buildSummary = (overrides: Partial<WorkOrderSummary> = {}): WorkOrderSummary => ({
	name: 'lo-13-rebuild-app',
	ticketRef: 'LO-13',
	branch: 'lo-13-rebuild-app',
	status: WorkOrderStatus.Building,
	plansDone: 1,
	plansTotal: 2,
	updatedAt,
	live: false,
	...overrides,
});

/**
 * The page under a memory-history router whose one route renders it, with the
 * summaries query seeded as the `/app/` loader would have filled it, so no
 * server function is ever called.
 */
const setupWorkOrdersScreen = async ({ summaries = [buildSummary()] }: { summaries?: WorkOrderSummary[] } = {}) => {
	const queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false, staleTime: Number.POSITIVE_INFINITY, refetchOnMount: false } },
	});
	queryClient.setQueryData(workOrderSummariesQueryOptions().queryKey, summaries);
	const rootRoute = createRootRoute();
	const workOrdersRoute = createRoute({ getParentRoute: () => rootRoute, path: '/app', component: WorkOrdersScreen });
	const router = createRouter({
		routeTree: rootRoute.addChildren([workOrdersRoute]),
		history: createMemoryHistory({ initialEntries: ['/app'] }),
	});
	await router.load();
	render(
		<QueryClientProvider client={queryClient}>
			<RouterProvider router={router} />
		</QueryClientProvider>,
	);
	await screen.findByRole('heading', { level: 1, name: 'Work orders' });
};

describe('WorkOrdersScreen', () => {
	test('says there are no work orders yet when the repo holds none', async () => {
		await setupWorkOrdersScreen({ summaries: [] });

		const emptyNote = screen.queryByText(/No work orders yet/);
		const rowLinks = screen.queryAllByRole('link');

		expect({ emptyNote: emptyNote !== null, rowLinks: rowLinks.length }).toStrictEqual({ emptyNote: true, rowLinks: 0 });
	});

	test('draws one row per work order with its ticket as plain text, status, plans done of total and updated time', async () => {
		await setupWorkOrdersScreen({ summaries: [buildSummary()] });

		const nameLink = screen.getByRole('link', { name: 'lo-13-rebuild-app' });
		const ticket = screen.getByText('LO-13');

		expect({
			nameHref: nameLink.getAttribute('href'),
			ticketLink: ticket.closest('a'),
			status: screen.queryByText(/Building/) !== null,
			plans: screen.queryByText(/1 of 2 plans/) !== null,
			updated: screen.queryByText(/7 Mar 2026, 09:05/) !== null,
		}).toStrictEqual({
			nameHref: '/app/work-orders/lo-13-rebuild-app',
			ticketLink: null,
			status: true,
			plans: true,
			updated: true,
		});
	});

	test('draws a row with no ticket when the work order carries none', async () => {
		await setupWorkOrdersScreen({ summaries: [buildSummary({ ticketRef: undefined })] });

		const rowText = screen.getByRole('link', { name: 'lo-13-rebuild-app' }).closest('li')?.textContent ?? '';

		expect({ plans: rowText.includes('1 of 2 plans'), ticket: rowText.includes('LO-13') }).toStrictEqual({ plans: true, ticket: false });
	});

	test('links a pull request only on a shipped row and shows a work order with no plans as having none', async () => {
		await setupWorkOrdersScreen({
			summaries: [
				buildSummary({
					name: 'lo-12-shipped',
					ticketRef: 'LO-12',
					status: WorkOrderStatus.Shipped,
					plansDone: 1,
					plansTotal: 1,
					prUrl: 'https://github.com/acme/widgets/pull/12',
				}),
				buildSummary({ name: 'lo-14-planless', ticketRef: 'LO-14', status: WorkOrderStatus.Planning, plansDone: 0, plansTotal: 0 }),
			],
		});

		const externalHrefs = screen
			.getAllByRole('link')
			.map((link) => link.getAttribute('href'))
			.filter((href) => href?.startsWith('/') !== true);
		const shippedNameLink = screen.getByRole('link', { name: 'lo-12-shipped' });
		const pullRequestLink = screen.getAllByRole('link').find((link) => link.getAttribute('href') === 'https://github.com/acme/widgets/pull/12');

		expect({
			externalHrefs,
			nestedInNameLink: pullRequestLink === undefined ? undefined : shippedNameLink.contains(pullRequestLink),
			noPlans: screen.queryByText(/No plans/) !== null,
		}).toStrictEqual({
			externalHrefs: ['https://github.com/acme/widgets/pull/12'],
			nestedInNameLink: false,
			noPlans: true,
		});
	});
});
