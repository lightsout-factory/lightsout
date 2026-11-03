import { IssueRow } from './ui/IssueRow.tsx';

// Incorrect: the screen sits directly under the feature, so nothing says it is
// what a route renders.
export const IssuesScreen = () => (
	<ul>
		<IssueRow title="Login fails" />
	</ul>
);
