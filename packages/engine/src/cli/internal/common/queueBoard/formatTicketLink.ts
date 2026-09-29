import { toInlineMarkdown } from '#src/cli/internal/common/queueBoard/toInlineMarkdown.ts';
import type { QueueBoardTicket } from '#src/contracts/queue/QueueBoardTicket.ts';

interface Params {
	ticket: Pick<QueueBoardTicket, 'identifier' | 'title' | 'url'>;
}

export const formatTicketLink = ({ ticket }: Params): string => {
	const title = ticket.title === undefined ? '' : toInlineMarkdown({ text: ticket.title });
	const label = title === '' ? ticket.identifier : `${ticket.identifier} · ${title}`;

	return ticket.url === undefined || ticket.url === '' ? label : `[${label}](${ticket.url})`;
};
