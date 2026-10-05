import { describeGateHold } from '#src/common/gates/describeGateHold.ts';
import { isTicketGateHeld } from '#src/common/gates/isTicketGateHeld.ts';
import type { GateHolds } from '#src/common/types/GateHolds.ts';
import type { LeftBehindTicket } from '#src/common/types/LeftBehindTicket.ts';
import type { QueueSettings } from '#src/common/types/QueueSettings.ts';
import type { TicketSummary } from '#src/common/types/TicketSummary.ts';
import type { RunnableTicket } from '#src/queue/common/types/RunnableTicket.ts';
import type { WaveSelection } from '#src/queue/common/types/WaveSelection.ts';
import { dedupeTickets } from '#src/queue/ticketSelection/selectWaveTickets/dedupeTickets.ts';

interface Params {
	/** Resumed and eligible tickets together, already in the order they would be worked. */
	tickets: TicketSummary[];
	settings: QueueSettings;
	/** Lower-cased identifiers this invocation has already offered to a wave. */
	attempted: Set<string>;
	/** The holds this drain reconciled once, at its start. */
	holds: GateHolds;
	onProgress?: (message: string) => void;
}

/**
 * The already-attempted filter runs before the dedupe, so every copy of an
 * ambiguous ticket leaves together and the ambiguity check still sees every copy
 * of the rest.
 *
 * A ticket that selects no worker is dropped in silence: it is in an ordinary
 * state, and reporting each would bury the real skips. A blocked ticket is left
 * behind rather than reordered; chain order falls out of repeated scans.
 *
 * A held ticket leaves as `blocked`, not `skipped`, because a human may release
 * the hold at any moment, so the next scan must re-offer it.
 */
export const selectWaveTickets = ({ tickets, settings, attempted, holds, onProgress }: Params): WaveSelection => {
	const fresh = tickets.filter((ticket) => !attempted.has(ticket.identifier.toLowerCase()));
	const { ordered, leftBehind } = dedupeTickets({ tickets: fresh, settings, onProgress });
	const runnable: RunnableTicket[] = [];
	const blocked: LeftBehindTicket[] = [];

	for (const ticket of ordered) {
		if (ticket.worker === undefined) {
			continue;
		}

		if (isTicketGateHeld({ holds, identifier: ticket.identifier, labels: ticket.labels })) {
			const held = describeGateHold({ hold: holds[ticket.identifier.toLowerCase()], identifier: ticket.identifier });

			onProgress?.(`${ticket.identifier} · ${held}`);
			blocked.push({ identifier: ticket.identifier, title: ticket.title, url: ticket.url, reason: held });
			continue;
		}

		if (ticket.unfinishedBlockers.length === 0) {
			runnable.push({ ...ticket, worker: ticket.worker });
			continue;
		}

		const reason = `waiting: blocked by ${ticket.unfinishedBlockers.join(', ')} — the queue takes it once every blocker is finished`;

		onProgress?.(`${ticket.identifier} · ${reason}`);
		blocked.push({ identifier: ticket.identifier, title: ticket.title, url: ticket.url, reason });
	}

	return { runnable, blocked, skipped: leftBehind };
};
