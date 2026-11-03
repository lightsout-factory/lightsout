import { createFileRoute } from '@tanstack/react-router';
import { IssuesScreen } from '../features/issues/screens/IssuesScreen.tsx';
import { findIssues } from '../features/issues/server/findIssues.ts';

// Incorrect: a second copy of the key and the fetch, written by hand.
export const Route = createFileRoute('/issues')({
	loader: ({ context }) => context.queryClient.ensureQueryData({ queryKey: ['issues'], queryFn: () => findIssues() }),
	component: IssuesScreen,
});
