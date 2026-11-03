import { StatusBadge } from '../../../components/ui/StatusBadge.tsx';

interface Params {
	title: string;
	status: string;
}

// Correct: used by this feature alone, so it stays in the feature.
export const IssueRow = ({ title, status }: Params) => (
	<li>
		{title} <StatusBadge label={status} />
	</li>
);
