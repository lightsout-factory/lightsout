import { createFileRoute } from '@tanstack/react-router';
import { issuesQueryOptions } from '../features/issues/queries/issuesQueryOptions.ts';
import { IssuesScreen } from '../features/issues/screens/IssuesScreen.tsx';

// Correct: the route reaches the feature through screens/ and queries/ only.
export const Route = createFileRoute('/issues')({
	loader: ({ context }) => context.queryClient.ensureQueryData(issuesQueryOptions()),
	component: IssuesScreen,
});
