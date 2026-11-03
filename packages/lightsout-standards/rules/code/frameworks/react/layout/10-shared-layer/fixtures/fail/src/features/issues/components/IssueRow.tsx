import { StatusBadge } from '../../../shared/StatusBadge.tsx';

interface Params {
	title: string;
	status: string;
}

export const IssueRow = ({ title, status }: Params) => (
	<li>
		{title} <StatusBadge label={status} />
	</li>
);
