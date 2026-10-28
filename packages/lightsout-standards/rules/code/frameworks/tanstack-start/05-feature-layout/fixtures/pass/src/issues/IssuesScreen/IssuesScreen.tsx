import { useSuspenseQuery } from '@tanstack/react-query';
import { issuesQueryOptions } from '../issuesQueryOptions.ts';
import { IssueRow } from './IssueRow.tsx';

// Correct: a module folder named for its export, at the top of the feature
// because the route imports it.
export const IssuesScreen = () => {
	const { data: issues } = useSuspenseQuery(issuesQueryOptions());

	return (
		<ul>
			{issues.map((issue) => (
				<IssueRow key={issue.id} title={issue.title} />
			))}
		</ul>
	);
};
