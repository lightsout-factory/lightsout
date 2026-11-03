import { StatusBadge } from '../../../shared/StatusBadge.tsx';

interface Params {
	number: string;
	status: string;
}

export const InvoiceRow = ({ number, status }: Params) => (
	<li>
		{number} <StatusBadge label={status} />
	</li>
);
