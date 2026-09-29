import { formatDistanceToNow } from 'date-fns';

interface Params {
	/** ISO timestamp, as every manifest and ledger line records one. */
	at: string;
}

export const formatRelativeTime = ({ at }: Params): string => {
	const parsed = new Date(at);

	return Number.isNaN(parsed.getTime()) ? at : `${formatDistanceToNow(parsed)} ago`;
};
