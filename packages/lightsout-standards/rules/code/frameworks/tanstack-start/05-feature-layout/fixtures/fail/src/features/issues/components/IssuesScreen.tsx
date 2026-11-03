import { useSuspenseQuery } from '@tanstack/react-query';
import { issuesQueryOptions } from '../queries/issuesQueryOptions.ts';

// Incorrect: the screen sits among the components, so the route has to reach
// into components/ to render it.
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
