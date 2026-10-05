import type { LeftBehindTicket } from '#src/common/types/LeftBehindTicket.ts';
import type { NamedWorkOrder } from '#src/queue/common/types/NamedWorkOrder.ts';
import type { LaneState } from '#src/queue/drainLanes/runDrainLanes/common/types/LaneState.ts';

interface Params {
	state: LaneState;
	/** The wave's named work orders, in the order they would be picked up. */
	workOrders: NamedWorkOrder[];
	/** Tickets held back until every blocker finishes — re-offered by the next scan. */
	blocked: LeftBehindTicket[];
	/** Tickets settled for good. Never re-offered. */
	skipped: LeftBehindTicket[];
}

/**
 * Takes the three lists rather than a `WaveSelection`, because a selection is
 * produced before anything is named, and that seam keeps selection free of the
 * network.
 *
 * A blocked entry is deliberately NOT marked attempted, so a later scan can
 * offer it once its blocker has merged. It is remembered under its identifier
 * instead, so it stays reportable after later scans stop returning it.
 *
 * @returns the work orders this scan added to the run, in admission order
 */
export const admitSelection = ({ state, workOrders, blocked, skipped }: Params): NamedWorkOrder[] => {
	const admitted: NamedWorkOrder[] = [];

	for (const workOrder of workOrders) {
		const identifier = workOrder.ticket.identifier.toLowerCase();

		if (!state.attempted.has(identifier)) {
			state.attempted.add(identifier);
			state.blockedByIdentifier.delete(identifier);
			state.pending.push(workOrder);
			state.queued.push(workOrder);
			admitted.push(workOrder);
		}
	}

	for (const entry of blocked) {
		state.blockedByIdentifier.set(entry.identifier.toLowerCase(), entry);
	}

	for (const entry of skipped) {
		state.attempted.add(entry.identifier.toLowerCase());
		state.blockedByIdentifier.delete(entry.identifier.toLowerCase());
		state.leftBehind.push(entry);
	}

	return admitted;
};
