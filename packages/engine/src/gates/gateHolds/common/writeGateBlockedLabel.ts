import { gateBlockedLabel } from '#src/common/constants/gateBlockedLabel.ts';
import type { TrackerSettings } from '#src/common/types/TrackerSettings.ts';
import { getTicketsByIdentifiers } from '#src/ticketTracker/getTicketsByIdentifiers.ts';
import { setTicketLabel } from '#src/ticketTracker/setTicketLabel.ts';

interface Params {
	settings: TrackerSettings;
	identifier: string;
}

/**
 * The tracker's own id is resolved from the human reference first, because
 * Linear addresses a ticket by id and only `getTicketsByIdentifiers` turns one
 * into the other.
 *
 * @returns undefined when the label landed, or one sentence naming why it did not
 */
export const writeGateBlockedLabel = async ({ settings, identifier }: Params): Promise<string | undefined> => {
	const found = await getTicketsByIdentifiers({ settings, identifiers: [identifier] });

	if ('error' in found) {
		return `the '${gateBlockedLabel}' label could not be written to ${identifier}: ${found.error}`;
	}

	const ticket = found[0];

	if (ticket === undefined) {
		return `the '${gateBlockedLabel}' label could not be written: the tracker knows no ticket ${identifier}`;
	}

	const written = await setTicketLabel({ settings, ticketId: ticket.id, label: gateBlockedLabel, present: true });

	return written === undefined ? undefined : `the '${gateBlockedLabel}' label could not be written to ${identifier}: ${written.error}`;
};
