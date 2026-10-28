import { useIssues } from '../useIssues.ts';

// Incorrect: nothing prefetched, so the screen paints a loading branch first,
// and it reads the query through a hook that only renames it.
export const IssuesScreen = () => {
	const { data: issues, isLoading } = useIssues();

	if (isLoading || issues === undefined) {
		return <p>Loading…</p>;
	}

	return (
		<ul>
			{issues.map((issue) => (
				<li key={issue.id}>{issue.title}</li>
			))}
		</ul>
	);
};
