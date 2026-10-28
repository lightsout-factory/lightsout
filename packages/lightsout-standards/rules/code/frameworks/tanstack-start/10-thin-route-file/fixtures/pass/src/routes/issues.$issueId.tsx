import { createFileRoute } from '@tanstack/react-router';
import { IssueDetailScreen } from '../issues/IssueDetailScreen/IssueDetailScreen.tsx';
import { issueDetailQueryOptions } from '../issues/issueDetailQueryOptions.ts';

// Correct: the route prefetches, names the tab and hands typed params to one
// screen. Everything with a test of its own lives in the screen.
const IssueDetailRoute = () => {
	const { issueId } = Route.useParams();

	return <IssueDetailScreen issueId={Number(issueId)} />;
};

export const Route = createFileRoute('/issues/$issueId')({
	loader: ({ context, params }) => context.queryClient.ensureQueryData(issueDetailQueryOptions({ issueId: Number(params.issueId) })),
	head: ({ params }) => ({ meta: [{ title: `Issue ${params.issueId}` }] }),
	component: IssueDetailRoute,
});
