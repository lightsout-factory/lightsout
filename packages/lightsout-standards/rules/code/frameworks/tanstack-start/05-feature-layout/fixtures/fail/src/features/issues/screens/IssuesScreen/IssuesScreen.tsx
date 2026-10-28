import { useSuspenseQuery } from '@tanstack/react-query';
import { issuesQueryOptions } from '../../queries/issuesQueryOptions.ts';
import { IssueRow } from './components/IssueRow.tsx';

// Incorrect: the screen reaches its query through a queries/ folder, and its
// one private child through a components/ folder.
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
