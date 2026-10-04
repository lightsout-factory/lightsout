import { TrackerStatusRole } from '#src/common/constants/TrackerStatusRole.ts';
import type { LifecycleSettings } from '#src/common/types/LifecycleSettings.ts';
import { updateTicketLifecycle } from '#src/ticketLifecycle/updateTicketLifecycle.ts';
import type { TrackerSettings } from '#src/ticketTracker/common/types/TrackerSettings.ts';
import { getTicketsByIdentifiers } from '#src/ticketTracker/getTicketsByIdentifiers.ts';

interface Params {
	/** The resolved lifecycle settings — label names and status names, defaults applied. */
	lifecycle: LifecycleSettings;
	trackerSettings: TrackerSettings;
	ticketId: string;
	/** The identifier the ticket is read back by when the first write does not answer. */
	ticketRef: string;
	/** The status the ticket held when the caller read it. */
	currentStatus: string | undefined;
}

/**
 * A blown tracker deadline cancels nothing: the request is still on its way, so
 * a write reported as failed may have landed a moment later. A failure is
 * therefore answered by reading the ticket back, and only a ticket that did not
 * move is written a second time — Jira refuses a self-transition its workflow
 * does not offer, so a blind second write would turn that refusal into the
 * reported error.
 *
 * The status comparison is exact, matching `updateTicketLifecycle`'s own.
 *
 * @returns undefined when the ticket reads Done, or the reason it does not — a
 * fragment the caller puts in its own sentence, since only the caller knows
 * what else it has already reported.
 */
export const writeDoneStatus = async ({ lifecycle, trackerSettings, ticketId, ticketRef, currentStatus }: Params): Promise<string | undefined> => {
	const failure = await updateTicketLifecycle({ lifecycle, trackerSettings, ticketId, trackerStatus: TrackerStatusRole.Done, currentStatus });

	if (failure === undefined) {
		return undefined;
	}

	const found = await getTicketsByIdentifiers({ settings: trackerSettings, identifiers: [ticketRef] });

	if ('error' in found) {
		return `${failure.error} (and it could not be read back to check: ${found.error})`;
	}

	const status = found[0]?.status;

	if (status === lifecycle.statusNames[TrackerStatusRole.Done]) {
		return undefined;
	}

	const second = await updateTicketLifecycle({ lifecycle, trackerSettings, ticketId, trackerStatus: TrackerStatusRole.Done, currentStatus: status });

	return second?.error;
};
