import { createFileRoute } from '@tanstack/react-router';
import { issuesQueryOptions } from '../features/issues/queries/issuesQueryOptions.ts';
import { IssuesScreen } from '../features/issues/screens/IssuesScreen/IssuesScreen.tsx';

// The route is wired as it should be; its imports show the folders in the way.
export const Route = createFileRoute('/issues')({
	loader: ({ context }) => context.queryClient.ensureQueryData(issuesQueryOptions()),
	component: IssuesScreen,
});
