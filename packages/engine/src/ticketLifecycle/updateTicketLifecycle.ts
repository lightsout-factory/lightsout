import { PlanningStatus } from '#src/common/constants/PlanningStatus.ts';
import type { TrackerStatusRole } from '#src/common/constants/TrackerStatusRole.ts';
import type { LifecycleSettings } from '#src/common/types/LifecycleSettings.ts';
import type { TrackerFailure } from '#src/common/types/TrackerFailure.ts';
import type { TrackerSettings } from '#src/common/types/TrackerSettings.ts';
import { setExclusiveLabel } from '#src/ticketTracker/setExclusiveLabel.ts';
import { setTicketStatus } from '#src/ticketTracker/setTicketStatus.ts';

interface Params {
	/** The resolved lifecycle settings — label names and status names, defaults applied. */
	lifecycle: LifecycleSettings;
	trackerSettings: TrackerSettings;
	ticketId: string;
	/** The planning status to record, or undefined to leave the ticket's alone. */
	planningStatus?: PlanningStatus;
	/** The status role to move the ticket to, or undefined to leave it where it is. */
	trackerStatus?: TrackerStatusRole;
	/**
	 * The status the ticket holds right now, when the caller already read it.
	 * Given, the status write is skipped when it already equals the target.
	 */
	currentStatus?: string;
}

/**
 * The parameter is `lifecycle` rather than `settings` because every caller also
 * holds a `TrackerSettings`. `trackerStatus` takes a role, never a status name,
 * so every caller stays free of status strings.
 *
 * A ticket already at the target status is not asked to move to it. That is not
 * an optimisation: Jira refuses when the workflow offers no self-transition,
 * which most do not, and treating that refusal as success would swallow a
 * genuinely misconfigured status name.
 *
 * The planning label is written first because the status is the visible
 * ownership marker, and ownership is the last thing to become true.
 */
export const updateTicketLifecycle = async ({
	lifecycle,
	trackerSettings,
	ticketId,
	planningStatus,
	trackerStatus,
	currentStatus,
}: Params): Promise<TrackerFailure | undefined> => {
	let failure: TrackerFailure | undefined;

	if (planningStatus !== undefined) {
		failure = await setExclusiveLabel({
			settings: trackerSettings,
			ticketId,
			label: lifecycle.planningStatusLabels[planningStatus],
			groupLabels: Object.values(PlanningStatus).map((status) => lifecycle.planningStatusLabels[status]),
		});
	}

	// A ticket that entered In Progress while still claiming shaping is owed is
	// worse than one that moved nowhere, so a failed label write stops here.
	if (failure === undefined && trackerStatus !== undefined) {
		const statusName = lifecycle.statusNames[trackerStatus];

		if (currentStatus !== statusName) {
			failure = await setTicketStatus({ settings: trackerSettings, ticketId, statusName });
		}
	}

	return failure;
};
