import { useQuery } from '@tanstack/react-query';
import { findIssues } from '../server/findIssues.ts';

// Incorrect: the screen spells the query and its key itself, so the loader
// below has to spell them again, and the two can drift.
export const IssuesScreen = () => {
	const { data: issues = [] } = useQuery({ queryKey: ['issues'], queryFn: () => findIssues() });

	return (
		<ul>
			{issues.map((issue) => (
				<li key={issue.id}>{issue.title}</li>
			))}
		</ul>
	);
};
