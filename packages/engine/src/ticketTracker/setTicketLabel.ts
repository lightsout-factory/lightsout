import type { TrackerFailure } from '#src/common/types/TrackerFailure.ts';
import type { TrackerSettings } from '#src/common/types/TrackerSettings.ts';
import { setTicketLabel as setJiraTicketLabel } from '#src/ticketTracker/jira/setTicketLabel.ts';
import { setTicketLabel as setLinearTicketLabel } from '#src/ticketTracker/linear/setTicketLabel.ts';

interface Params {
	settings: TrackerSettings;
	ticketId: string;
	label: string | undefined;
	present: boolean;
}

/**
 * An undefined `label` is a deliberate no-op that succeeds, so a caller holding
 * an optional configured label hands it straight through.
 */
export const setTicketLabel = async (params: Params): Promise<TrackerFailure | undefined> =>
	params.settings.provider === 'linear'
		? setLinearTicketLabel({ ...params, settings: params.settings })
		: setJiraTicketLabel({ ...params, settings: params.settings });
