import { createFileRoute } from '@tanstack/react-router';
import { IssuesScreen } from '../issues/IssuesScreen/IssuesScreen.tsx';
import { findIssues } from '../issues/server/findIssues.ts';

// Incorrect: a second copy of the key and the fetch, written by hand.
export const Route = createFileRoute('/issues')({
	loader: ({ context }) => context.queryClient.ensureQueryData({ queryKey: ['issues'], queryFn: () => findIssues() }),
	component: IssuesScreen,
});
