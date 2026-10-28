import { createFileRoute } from '@tanstack/react-router';
import { IssuesScreen } from '../issues/IssuesScreen/IssuesScreen.tsx';
import { issuesQueryOptions } from '../issues/issuesQueryOptions.ts';

// The loader prefetches through the same object the screen reads.
export const Route = createFileRoute('/issues')({
	loader: ({ context }) => context.queryClient.ensureQueryData(issuesQueryOptions()),
	component: IssuesScreen,
});
