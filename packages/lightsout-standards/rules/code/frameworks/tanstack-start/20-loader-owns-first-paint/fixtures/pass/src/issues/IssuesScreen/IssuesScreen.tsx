import { useSuspenseQuery } from '@tanstack/react-query';
import { issuesQueryOptions } from '../issuesQueryOptions.ts';

// Correct: the data is already in the cache, so the screen reads it and renders.
export const IssuesScreen = () => {
	const { data: issues } = useSuspenseQuery(issuesQueryOptions());

	return (
		<ul>
			{issues.map((issue) => (
				<li key={issue.id}>{issue.title}</li>
			))}
		</ul>
	);
};
