import { QueueBoardState } from '#src/cli/internal/common/constants/QueueBoardState.ts';
import { queueUpdateIntervalMs } from '#src/cli/internal/common/constants/queueUpdateIntervalMs.ts';
import { formatTicketLink } from '#src/cli/internal/common/queueBoard/formatTicketLink.ts';
import { toInlineMarkdown } from '#src/cli/internal/common/queueBoard/toInlineMarkdown.ts';
import type { QueueBoardTicket } from '#src/contracts/queue/QueueBoardTicket.ts';
import { QueueLane } from '#src/contracts/queue/QueueLane.ts';

/** Keyed by `QueueLane` rather than `string`, so a new lane fails the typecheck here instead of drawing a blank header. */
const laneLabels: Record<QueueLane, string> = {
	[QueueLane.Parked]: 'Parked',
	[QueueLane.Blocked]: 'Blocked',
	[QueueLane.BuildQueue]: 'Build Queue',
	[QueueLane.Building]: 'Building',
	[QueueLane.ShipQueue]: 'Ship Queue',
	[QueueLane.ShippingNow]: 'Shipping Now',
	[QueueLane.Shipped]: 'Shipped',
};

const lanesWithReason = new Set<QueueLane>([QueueLane.Shipped, QueueLane.Parked, QueueLane.Blocked]);

/** Local time, because a reader compares it against the clock on their own screen. */
const toClock = ({ at }: { at: Date }) => `${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}`;

const toHeading = ({ state, at }: { state: QueueBoardState; at: Date }) => {
	const time = toClock({ at });
	let heading = `Queue finished · ${time}`;

	if (state === QueueBoardState.Live) {
		heading = `Queue update · ${time} · next update ${toClock({ at: new Date(at.getTime() + queueUpdateIntervalMs) })}`;
	} else if (state === QueueBoardState.Stopped) {
		heading = `Queue stopped · last update ${time}`;
	}

	return heading;
};

/** The identifier alone, so no cell wraps over several lines in a terminal. */
const toCell = ({ ticket }: { ticket: QueueBoardTicket }) => formatTicketLink({ ticket: { identifier: ticket.identifier, url: ticket.url } });

const toDetailLine = ({ ticket }: { ticket: QueueBoardTicket }) => {
	const label = formatTicketLink({ ticket: { identifier: ticket.identifier, title: ticket.title } });
	// Clipped so one long error cannot fill the screen; the queue's own report keeps the full text.
	const maxReasonLength = 120;

	return ticket.reason !== undefined && lanesWithReason.has(ticket.lane)
		? `- ${label} — ${toInlineMarkdown({ text: ticket.reason, maxLength: maxReasonLength })}`
		: `- ${label}`;
};

const toRow = ({ cells }: { cells: string[] }) => `| ${cells.join(' | ')} |`;

interface Params {
	tickets: QueueBoardTicket[];
	state: QueueBoardState;
	/** The time the heading shows: the render time on a live board, the last update or the finish otherwise. */
	at: Date;
}

/**
 * An empty lane keeps its column, so a ticket visibly moves across columns from
 * one post to the next. No terminal paint: the lines are markdown the queue
 * skill posts into a conversation.
 */
export const renderQueueBoard = ({ tickets, state, at }: Params): string[] => {
	const lanes = Object.values(QueueLane);
	const header = toRow({ cells: lanes.map((lane) => laneLabels[lane]) });
	const separator = toRow({ cells: lanes.map(() => '---') });
	const laneTickets = lanes.map((lane) => tickets.filter((ticket) => ticket.lane === lane));
	const columns = laneTickets.map((inLane) => inLane.map((ticket) => toCell({ ticket })));
	const depth = Math.max(1, ...columns.map((cells) => cells.length));
	const body = Array.from({ length: depth }, (_, row) => toRow({ cells: columns.map((cells) => cells[row] ?? (row === 0 ? '—' : '')) }));
	const details = laneTickets.flat().map((ticket) => toDetailLine({ ticket }));

	return [toHeading({ state, at }), '', header, separator, ...body, ...(details.length === 0 ? [] : ['', ...details])];
};
