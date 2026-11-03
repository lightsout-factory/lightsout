import { useSuspenseQuery } from '@tanstack/react-query';
import { issuesQueryOptions } from '../queries/issuesQueryOptions.ts';

// Correct: the screen the route renders sits in screens/.
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
