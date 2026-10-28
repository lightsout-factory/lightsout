import { useQuery } from '@tanstack/react-query';
import { createFileRoute, useParams } from '@tanstack/react-router';
import { issueDetailQueryOptions } from '../issues/issueDetailQueryOptions.ts';

// Incorrect: the screen lives in the route file — a fetch, a loading branch and
// markup under a URL for a name — and reads its params through the untyped hook.
const IssueDetailPage = () => {
	const { issueId } = useParams({ strict: false });
	const { data: issue, isLoading } = useQuery(issueDetailQueryOptions({ issueId: Number(issueId) }));

	if (isLoading || issue === undefined) {
		return <p>Loading…</p>;
	}

	return (
		<article>
			<h1>{issue.title}</h1>
			<p>{issue.summary}</p>
		</article>
	);
};

export const Route = createFileRoute('/issues/$issueId')({ component: IssueDetailPage });
