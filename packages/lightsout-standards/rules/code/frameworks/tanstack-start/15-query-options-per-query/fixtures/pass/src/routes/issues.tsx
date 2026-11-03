import { createFileRoute } from '@tanstack/react-router';
import { IssuesScreen } from '../features/issues/screens/IssuesScreen.tsx';
import { issuesQueryOptions } from '../features/issues/queries/issuesQueryOptions.ts';

// The loader prefetches through the same object the screen reads.
export const Route = createFileRoute('/issues')({
	loader: ({ context }) => context.queryClient.ensureQueryData(issuesQueryOptions()),
	component: IssuesScreen,
});
