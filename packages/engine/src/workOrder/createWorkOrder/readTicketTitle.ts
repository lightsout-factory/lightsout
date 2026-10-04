import type { LightsoutConfig } from '#src/contracts/LightsoutConfig/LightsoutConfig.ts';
import { getTicketsByIdentifiers } from '#src/ticketTracker/getTicketsByIdentifiers.ts';
import { resolveTrackerSettings } from '#src/ticketTracker/resolveTrackerSettings.ts';

interface Params {
	/** In whatever case the caller typed it. */
	ticketRef: string;
	config: LightsoutConfig;
	env: NodeJS.ProcessEnv;
}

/**
 * Returns the reference as the tracker spells it, so a caller who typed `lo-158`
 * files the work order under `LO-158`.
 *
 * A refusal is never turned into a guessed title downstream, so the message
 * offers `--title` instead.
 */
export const readTicketTitle = async ({ ticketRef, config, env }: Params): Promise<{ ticketRef: string; title: string } | { error: string }> => {
	const settings = resolveTrackerSettings({ config, env });

	if ('error' in settings) {
		return { error: `${settings.error} — or name this work yourself with \`--title <words>\`, which needs no tracker at all` };
	}

	const tickets = await getTicketsByIdentifiers({ settings, identifiers: [ticketRef] });

	if ('error' in tickets) {
		return { error: `the tracker could not be asked about ${ticketRef}: ${tickets.error}` };
	}

	const ticket = tickets[0];

	return ticket === undefined
		? { error: `the tracker holds no ticket ${ticketRef} — check the reference, or name this work yourself with \`--title <words>\`` }
		: { ticketRef: ticket.identifier, title: ticket.title };
};
