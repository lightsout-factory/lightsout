import { StatusBadge } from '../../../components/ui/StatusBadge.tsx';

interface Params {
	number: string;
	status: string;
}

// Correct: both features import the badge from the shared layer, and neither
// knows the other exists.
export const InvoiceRow = ({ number, status }: Params) => (
	<li>
		{number} <StatusBadge label={status} />
	</li>
);
