import type { TrackerFailure } from '#src/ticketTracker/common/types/TrackerFailure.ts';
import type { JiraTrackerSettings } from '#src/ticketTracker/common/types/TrackerSettings.ts';
import { runJira } from '#src/ticketTracker/jira/internal/runJira.ts';

interface LabelPage {
	values: string[];
	isLast: boolean;
}

interface Params {
	settings: JiraTrackerSettings;
}

/**
 * Instance-wide rather than project-scoped, because Jira Cloud publishes no
 * project-scoped label catalog; an instance-wide answer is a superset of the
 * project's.
 *
 * A caller reporting a missing label must tell the user to apply it to any
 * issue in the project, never to "create" it: a Jira label comes into being the
 * first time an issue carries it.
 */
export const listLabelNames = async ({ settings }: Params): Promise<string[] | TrackerFailure> =>
	runJira({
		settings,
		request: async (client) => {
			// Sent explicitly: a server default the engine does not control could
			// truncate the catalog and report a configured label as missing.
			const labelPageSize = 200;
			const names: string[] = [];
			let startAt = 0;
			let isLast = false;

			do {
				const path = `/rest/api/3/label?startAt=${startAt}&maxResults=${labelPageSize}`;
				const page = await client.request<LabelPage>({ method: 'GET', path, response: 'json' });

				if (!page.isLast && page.values.length === 0) {
					return { error: 'Jira returned a nonfinal label page with no values' };
				}

				names.push(...page.values);
				startAt += page.values.length;
				isLast = page.isLast;
			} while (!isLast);

			return names;
		},
	});
