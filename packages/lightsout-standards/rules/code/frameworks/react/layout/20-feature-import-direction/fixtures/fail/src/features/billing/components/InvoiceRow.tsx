import { StatusBadge } from '../../issues/components/StatusBadge.tsx';

interface Params {
	number: string;
	status: string;
}

// Incorrect: billing imports from issues, so neither feature can change or go
// without the other.
export const InvoiceRow = ({ number, status }: Params) => (
	<li>
		{number} <StatusBadge label={status} />
	</li>
);
