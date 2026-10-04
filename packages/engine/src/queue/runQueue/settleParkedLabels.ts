import { isParkedOutcome } from '#src/common/runs/isParkedOutcome.ts';
import type { QueueSettings } from '#src/common/types/QueueSettings.ts';
import type { TrackerSettings } from '#src/common/types/TrackerSettings.ts';
import type { WorkOrderRunOutcome } from '#src/common/types/WorkOrderRunOutcome.ts';
import { setTicketLabel } from '#src/ticketTracker/setTicketLabel.ts';

interface Params {
	settings: QueueSettings;
	trackerSettings: TrackerSettings;
	/** Every settled outcome, after `shipOneBranch` has finished with each ready branch. */
	outcomes: WorkOrderRunOutcome[];
	onProgress?: (message: string) => void;
}

/**
 * Settled once per drain rather than at each park site, because a park in the
 * worker and a park at the ship step are the same fact, and only this list knows both.
 *
 * A failed write is only a progress line: the tracker is a courtesy, never a
 * precondition for building.
 */
export const settleParkedLabels = async ({ settings, trackerSettings, outcomes, onProgress }: Params): Promise<void> => {
	if (settings.parkedLabel === undefined) {
		return;
	}

	await Promise.all(
		outcomes.map(async (outcome) => {
			const written = await setTicketLabel({
				settings: trackerSettings,
				ticketId: outcome.ticket.id,
				label: settings.parkedLabel,
				present: isParkedOutcome({ outcome }),
			});

			if (written !== undefined) {
				onProgress?.(`${outcome.ticket.identifier} · the '${settings.parkedLabel}' label could not be written: ${written.error}`);
			}
		}),
	);
};
