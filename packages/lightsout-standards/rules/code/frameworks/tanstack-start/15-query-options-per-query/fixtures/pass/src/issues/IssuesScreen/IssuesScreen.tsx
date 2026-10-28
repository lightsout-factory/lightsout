import { useSuspenseQuery } from '@tanstack/react-query';
import { issuesQueryOptions } from '../issuesQueryOptions.ts';

// Correct: the screen reads the one options object and writes no key.
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
