import type { IssueLabel, LinearClient } from '@linear/sdk';
import type { TrackerFailure } from '#src/ticketTracker/common/types/TrackerFailure.ts';
import type { LinearTrackerSettings } from '#src/ticketTracker/common/types/TrackerSettings.ts';
import { buildLabelScopeFilter } from '#src/ticketTracker/linear/internal/common/utils/buildLabelScopeFilter.ts';
import { collectNodes } from '#src/ticketTracker/linear/internal/common/utils/collectNodes.ts';
import { runLinear } from '#src/ticketTracker/linear/internal/runLinear.ts';

interface Params {
	settings: LinearTrackerSettings;
	ticketId: string;
	label: string;
	groupLabels: string[];
}

/**
 * The scope filter can answer a team label and a workspace label with one name;
 * preferring the team's keeps two runs from adding different ids.
 */
const targetLabelIdOf = ({ catalog, label }: { catalog: IssueLabel[]; label: string }) => {
	const matches = catalog.filter((node) => node.name === label);

	return (matches.find((node) => node.teamId !== undefined) ?? matches.at(0))?.id;
};

/**
 * Puts the siblings back when the add is rejected: with no group label the
 * ticket reads as "not delegated" and nothing comes back to it. The rollback is
 * best-effort; the caller is told the original failure either way.
 */
const addTargetLabel = async ({ client, ticketId, targetId, removed }: { client: LinearClient; ticketId: string; targetId: string; removed: IssueLabel[] }) => {
	try {
		await client.issueAddLabel(ticketId, targetId);
	} catch (error) {
		for (const node of removed) {
			await client.issueAddLabel(ticketId, node.id).catch(() => undefined);
		}

		throw error;
	}
};

/**
 * Siblings are removed before the target is added: in a Linear label group the
 * add drops siblings server-side, so later removals would target labels the
 * issue no longer carries and could be rejected. The brief window with no group
 * label reads as "not delegated", which the next pass heals.
 *
 * Siblings are removed by the id the issue reports, since two labels can share a
 * name and removing the wrong id is a silent no-op.
 *
 * Never creates a label: `listLabelNames` checks the configuration at startup.
 */
export const setExclusiveLabel = async ({ settings, ticketId, label, groupLabels }: Params): Promise<TrackerFailure | undefined> =>
	runLinear({
		apiKey: settings.apiKey,
		call: async (client) => {
			const filter = { name: { in: groupLabels }, or: buildLabelScopeFilter({ team: settings.team }) };
			const catalog = await collectNodes({ connection: await client.issueLabels({ filter }) });
			const targetId = targetLabelIdOf({ catalog, label });

			if (targetId === undefined) {
				return { error: `the '${settings.team}' team has no '${label}' label` };
			}

			const issue = await client.issue(ticketId);
			const carried = await collectNodes({ connection: await issue.labels() });
			const siblings = carried.filter((node) => node.name !== label && groupLabels.includes(node.name));

			for (const sibling of siblings) {
				await client.issueRemoveLabel(ticketId, sibling.id);
			}

			if (!carried.some((node) => node.name === label)) {
				await addTargetLabel({ client, ticketId, targetId, removed: siblings });
			}

			return undefined;
		},
	});
