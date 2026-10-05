import { formatTicketLink } from '#src/cli/common/queueBoard/formatTicketLink.ts';
import { toInlineMarkdown } from '#src/cli/common/queueBoard/toInlineMarkdown.ts';
import type { QueueBoardTicket } from '#src/contracts/queue/QueueBoardTicket.ts';

interface Params {
	ticket: QueueBoardTicket;
	/** The status command's own lines for this ticket, emitted exactly as given. */
	lines: string[];
}

/**
 * The waiting question goes in the heading, outside the fence, because nothing
 * inside the fence may differ from what the standalone status command prints.
 */
export const renderTicketDetailBlock = ({ ticket, lines }: Params): string[] => {
	const waiting = ticket.question === undefined ? '' : ` — waiting for an answer: ${toInlineMarkdown({ text: ticket.question })}`;

	return ['', `**${formatTicketLink({ ticket })}**${waiting}`, '', '```text', ...lines, '```'];
};
