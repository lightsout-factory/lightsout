import { useSuspenseQuery } from '@tanstack/react-query';
import { issuesQueryOptions } from '../issuesQueryOptions.ts';

export const IssuesScreen = () => {
	const { data: issues } = useSuspenseQuery(issuesQueryOptions());

	return (
		<section>
			<h1>Issues</h1>
			<ul>
				{issues.map((issue) => (
					<li key={issue.id}>{issue.title}</li>
				))}
			</ul>
		</section>
	);
};
