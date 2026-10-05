import type { TrackerFailure } from '#src/common/types/TrackerFailure.ts';
import type { TrackerSettings } from '#src/common/types/TrackerSettings.ts';
import { setTicketStatus as setJiraTicketStatus } from '#src/ticketTracker/jira/setTicketStatus.ts';
import { setTicketStatus as setLinearTicketStatus } from '#src/ticketTracker/linear/setTicketStatus.ts';

interface Params {
	settings: TrackerSettings;
	ticketId: string;
	statusName: string;
}

export const setTicketStatus = async (params: Params): Promise<TrackerFailure | undefined> =>
	params.settings.provider === 'linear'
		? setLinearTicketStatus({ ...params, settings: params.settings })
		: setJiraTicketStatus({ ...params, settings: params.settings });
