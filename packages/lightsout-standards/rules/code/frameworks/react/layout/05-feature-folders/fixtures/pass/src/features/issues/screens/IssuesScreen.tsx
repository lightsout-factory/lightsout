import { IssueRow } from '../components/IssueRow.tsx';

// Correct: the screen a route renders sits in screens/, named with the suffix.
export const IssuesScreen = () => (
	<ul>
		<IssueRow title="Login fails" />
	</ul>
);
