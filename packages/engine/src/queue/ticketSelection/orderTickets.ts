import type { TicketSummary } from '#src/queue/common/types/TicketSummary.ts';

interface Params {
	tickets: TicketSummary[];
}

// Linear's priority 0 means "no priority", so it sorts last rather than first.
export const orderTickets = ({ tickets }: Params): TicketSummary[] => {
	const rank = ({ priority }: TicketSummary) => (priority === 0 ? 6 : priority);

	return [...tickets].sort((left, right) => rank(left) - rank(right) || left.createdAt.localeCompare(right.createdAt));
};
