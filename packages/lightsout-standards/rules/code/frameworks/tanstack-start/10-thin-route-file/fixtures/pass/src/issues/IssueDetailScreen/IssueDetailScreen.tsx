import { useSuspenseQuery } from '@tanstack/react-query';
import { issueDetailQueryOptions } from '../issueDetailQueryOptions.ts';

interface Params {
	issueId: number;
}

// The screen holds the markup and reads what the route's loader fetched.
export const IssueDetailScreen = ({ issueId }: Params) => {
	const { data: issue } = useSuspenseQuery(issueDetailQueryOptions({ issueId }));

	return (
		<article>
			<h1>{issue.title}</h1>
			<p>{issue.summary}</p>
		</article>
	);
};
