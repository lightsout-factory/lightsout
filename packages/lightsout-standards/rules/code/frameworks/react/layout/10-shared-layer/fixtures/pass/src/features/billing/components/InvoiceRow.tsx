import { StatusBadge } from '../../../components/ui/StatusBadge.tsx';

interface Params {
	number: string;
	status: string;
}

export const InvoiceRow = ({ number, status }: Params) => (
	<li>
		{number} <StatusBadge label={status} />
	</li>
);
