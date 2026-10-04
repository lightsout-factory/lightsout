import type { TrackerFailure } from '#src/common/types/TrackerFailure.ts';
import type { LinearTrackerSettings } from '#src/common/types/TrackerSettings.ts';
import { buildLabelScopeFilter } from '#src/ticketTracker/linear/common/buildLabelScopeFilter.ts';
import { collectNodes } from '#src/ticketTracker/linear/common/collectNodes.ts';
import { runLinear } from '#src/ticketTracker/linear/common/runLinear.ts';

interface Params {
	settings: LinearTrackerSettings;
}

/** Includes workspace-level labels, which belong to no team. */
export const listLabelNames = async ({ settings }: Params): Promise<string[] | TrackerFailure> =>
	runLinear({
		apiKey: settings.apiKey,
		call: async (client) => {
			const connection = await client.issueLabels({ filter: { or: buildLabelScopeFilter({ team: settings.team }) } });
			const labels = await collectNodes({ connection });

			return labels.map((label) => label.name);
		},
	});
