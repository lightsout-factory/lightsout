import { createFileRoute } from '@tanstack/react-router';
import { IssuesScreen } from '../features/issues/components/IssuesScreen.tsx';
import { issuesQueryOptions } from '../features/issues/queries/issuesQueryOptions.ts';

// Incorrect: the route imports from the feature's components/, which is the
// screen's to compose from, not the route's to reach.
export const Route = createFileRoute('/issues')({
	loader: ({ context }) => context.queryClient.ensureQueryData(issuesQueryOptions()),
	component: IssuesScreen,
});
