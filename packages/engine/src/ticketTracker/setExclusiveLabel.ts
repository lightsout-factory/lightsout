import type { TrackerFailure } from '#src/common/types/TrackerFailure.ts';
import type { TrackerSettings } from '#src/common/types/TrackerSettings.ts';
import { setExclusiveLabel as setJiraExclusiveLabel } from '#src/ticketTracker/jira/setExclusiveLabel.ts';
import { setExclusiveLabel as setLinearExclusiveLabel } from '#src/ticketTracker/linear/setExclusiveLabel.ts';

interface Params {
	settings: TrackerSettings;
	ticketId: string;
	label: string;
	/** `label` included. */
	groupLabels: string[];
}

/**
 * Labels outside `groupLabels` are never touched, and `label` needs no membership
 * guard: the removal set is `groupLabels` minus `label`. It never creates a label;
 * whether configured labels exist is answered once, by `listLabelNames`, at startup.
 */
export const setExclusiveLabel = async (params: Params): Promise<TrackerFailure | undefined> =>
	params.settings.provider === 'linear'
		? setLinearExclusiveLabel({ ...params, settings: params.settings })
		: setJiraExclusiveLabel({ ...params, settings: params.settings });
