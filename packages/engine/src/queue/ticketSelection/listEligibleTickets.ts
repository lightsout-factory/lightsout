import { PlanningStatus } from '#src/common/constants/PlanningStatus.ts';
import type { TrackerSettings } from '#src/common/types/TrackerSettings.ts';
import type { QueueFailure } from '#src/queue/common/types/QueueFailure.ts';
import type { QueueSettings } from '#src/queue/common/types/QueueSettings.ts';
import type { TicketSummary } from '#src/queue/common/types/TicketSummary.ts';
import { toPlanningSummaries } from '#src/queue/internal/common/utils/toPlanningSummaries.ts';
import { listTickets } from '#src/ticketTracker/listTickets.ts';

interface Params {
	settings: QueueSettings;
	trackerSettings: TrackerSettings;
}

// A ticket with more than one planning-status label deliberately yields one
// summary per status: the ambiguity skip lives in the drain.
export const listEligibleTickets = async ({ settings, trackerSettings }: Params): Promise<TicketSummary[] | QueueFailure> => {
	const tickets = await listTickets({
		settings: trackerSettings,
		labelNames: Object.values(PlanningStatus).map((status) => settings.lifecycle.planningStatusLabels[status]),
		statuses: settings.lifecycle.eligibleStatuses,
	});

	if ('error' in tickets) {
		return tickets;
	}

	return tickets.flatMap((ticket) => toPlanningSummaries({ ticket, lifecycle: settings.lifecycle, resumed: false }));
};
