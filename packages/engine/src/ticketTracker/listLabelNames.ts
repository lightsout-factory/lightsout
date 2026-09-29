import type { TrackerFailure } from '#src/ticketTracker/common/types/TrackerFailure.ts';
import type { TrackerSettings } from '#src/ticketTracker/common/types/TrackerSettings.ts';
import { listLabelNames as listJiraLabelNames } from '#src/ticketTracker/jira/listLabelNames.ts';
import { listLabelNames as listLinearLabelNames } from '#src/ticketTracker/linear/listLabelNames.ts';

interface Params {
	settings: TrackerSettings;
}

/**
 * Every page is walked, because a truncated catalog would report a configured
 * label as missing when it exists. Order is whatever the tracker answered.
 */
export const listLabelNames = async (params: Params): Promise<string[] | TrackerFailure> =>
	params.settings.provider === 'linear'
		? listLinearLabelNames({ ...params, settings: params.settings })
		: listJiraLabelNames({ ...params, settings: params.settings });
