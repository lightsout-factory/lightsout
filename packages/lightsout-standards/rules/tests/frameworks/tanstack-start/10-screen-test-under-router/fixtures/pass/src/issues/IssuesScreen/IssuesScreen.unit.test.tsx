import { describe, expect, test } from '@jest/globals';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createMemoryHistory, createRootRoute, createRoute, createRouter } from '@tanstack/react-router';
import { render, screen } from '@testing-library/react';
import type { Issue } from '../common/types/Issue.ts';
import { issuesQueryOptions } from '../issuesQueryOptions.ts';
import { IssuesScreen } from './IssuesScreen.tsx';

// Correct: the screen renders under a router whose one route is its own, with a
// query client holding what the loader would have fetched.
const setupIssuesScreen = ({ issues = [{ id: 1, title: 'Login fails' }] }: { issues?: Issue[] } = {}) => {
	const queryClient = new QueryClient();
	queryClient.setQueryData(issuesQueryOptions().queryKey, issues);
	const rootRoute = createRootRoute();
	const issuesRoute = createRoute({ getParentRoute: () => rootRoute, path: '/issues', component: IssuesScreen });
	const router = createRouter({ routeTree: rootRoute.addChildren([issuesRoute]), history: createMemoryHistory({ initialEntries: ['/issues'] }) });

	render(
		<QueryClientProvider client={queryClient}>
			<RouterProvider router={router} />
		</QueryClientProvider>,
	);
};

describe('IssuesScreen', () => {
	test('lists each issue by title', async () => {
		setupIssuesScreen();

		const row = await screen.findByText('Login fails');

		expect(row).toBeInTheDocument();
	});
});
