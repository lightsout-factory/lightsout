import { createFileRoute } from '@tanstack/react-router';
import { IssuesScreen } from '../issues/IssuesScreen/IssuesScreen.tsx';
import { issuesQueryOptions } from '../issues/issuesQueryOptions.ts';

// The route imports from the feature's top level and nothing deeper.
export const Route = createFileRoute('/issues')({
	loader: ({ context }) => context.queryClient.ensureQueryData(issuesQueryOptions()),
	component: IssuesScreen,
});
