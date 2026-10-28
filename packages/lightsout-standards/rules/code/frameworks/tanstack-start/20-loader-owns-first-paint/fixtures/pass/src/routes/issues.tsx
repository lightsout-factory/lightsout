import { createFileRoute } from '@tanstack/react-router';
import { IssuesScreen } from '../issues/IssuesScreen/IssuesScreen.tsx';
import { issuesQueryOptions } from '../issues/issuesQueryOptions.ts';

// Correct: the loader fetches through the object the screen reads, so the
// screen's first render has its data.
export const Route = createFileRoute('/issues')({
	loader: ({ context }) => context.queryClient.ensureQueryData(issuesQueryOptions()),
	component: IssuesScreen,
});
