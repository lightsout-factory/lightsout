import type { QueueDrainReport } from '#src/queue/common/types/QueueDrainReport.ts';
import type { WorkOrderRunOutcome } from '#src/queue/common/types/WorkOrderRunOutcome.ts';
import type { LaneContext } from '#src/queue/drainLanes/internal/common/types/LaneContext.ts';
import type { LaneFlight } from '#src/queue/drainLanes/internal/common/types/LaneFlight.ts';
import type { LaneState } from '#src/queue/drainLanes/internal/common/types/LaneState.ts';
import { admitScanned } from '#src/queue/drainLanes/internal/common/utils/admitScanned.ts';
import { startBuilds } from '#src/queue/drainLanes/internal/common/utils/startBuilds.ts';
import { startScan } from '#src/queue/drainLanes/internal/common/utils/startScan.ts';
import { startShip } from '#src/queue/drainLanes/internal/common/utils/startShip.ts';
import { writeQueuePlan } from '#src/queue/drainLanes/internal/common/utils/writeQueuePlan.ts';
import type { LeftBehindTicket } from '#src/queue/internal/common/types/LeftBehindTicket.ts';
import type { WaveSelection } from '#src/queue/internal/common/types/WaveSelection.ts';

interface Params extends LaneContext {
	/** The opening selection, straight from the startup scan and not yet reconciled against already-merged branches. */
	first: WaveSelection;
	/** Outcomes settled before the drain began — the parked scan's. Ready ones enter the ship lane ahead of every branch built here. */
	carried: WorkOrderRunOutcome[];
	/** The entries settled before the drain began: the parked scan's, then the settled merged trees'. The report lists them first, in this order. */
	carriedLeftBehind: LeftBehindTicket[];
	/** Lower-cased identifiers the parked scan already settled, never offered to a builder. */
	attempted: Set<string>;
}

const seedState = ({
	attempted,
	carried,
	carriedLeftBehind,
}: {
	attempted: Set<string>;
	carried: WorkOrderRunOutcome[];
	carriedLeftBehind: LeftBehindTicket[];
}): LaneState => ({
	pending: [],
	queued: [],
	building: new Map(),
	readyToShip: carried.filter((outcome) => outcome.ready),
	shipping: undefined,
	outcomes: carried.filter((outcome) => !outcome.ready),
	leftBehind: [...carriedLeftBehind],
	attempted: new Set(attempted),
	blockedByIdentifier: new Map(),
	retired: 0,
	rescanRequested: false,
	idleScanSpent: false,
	scansStopped: false,
});

/** Both lists are emptied, so the last board snapshot shows each ticket once, in Blocked. */
const finishDrain = ({ context, state }: { context: LaneContext; state: LaneState }): QueueDrainReport => {
	for (const { ticket } of state.pending) {
		const reason = 'not started: every slot was retired by a ticket parked on an unanswered question';

		state.leftBehind.push({ identifier: ticket.identifier, title: ticket.title, url: ticket.url, reason });
		context.onProgress?.(`${ticket.identifier} · ${reason}`);
	}

	state.pending = [];
	state.leftBehind.push(...state.blockedByIdentifier.values());
	state.blockedByIdentifier.clear();

	return { outcomes: state.outcomes, leftBehind: state.leftBehind };
};

/** Never awaited: a slow or failed board write must not hold the drain up. */
const recordBoard = ({ context, state }: { context: LaneContext; state: LaneState }) => {
	context.board.record({
		settled: { outcomes: state.outcomes, leftBehind: state.leftBehind },
		lanes: {
			pending: state.pending,
			building: [...state.building.values()],
			readyToShip: state.readyToShip,
			shipping: state.shipping,
			blocked: [...state.blockedByIdentifier.values()],
		},
	});
};

/**
 * A freed slot goes to a waiting ready branch before a new build, or a long
 * backlog would starve the ship lane.
 *
 * `pending` is deliberately not part of the end test: once every builder slot
 * is retired no build can start, and what is left is reported as never started.
 * The loop terminates because `attempted` only grows.
 */
export const runDrainLanes = async ({ first, carried, carriedLeftBehind, attempted, ...context }: Params): Promise<QueueDrainReport> => {
	const state = seedState({ attempted, carried, carriedLeftBehind });
	const flight: LaneFlight = { tasks: new Map(), builds: 0, ships: 0, scans: 0, nextKey: 0 };

	await admitScanned({ context, state, selection: first });
	await writeQueuePlan({ path: context.planPath, cwd: context.cwd, queued: state.queued });

	for (;;) {
		startShip({ context, state, flight });
		startBuilds({ context, state, flight });
		startScan({ context, state, flight });
		recordBoard({ context, state });

		if (flight.tasks.size === 0) {
			break;
		}

		flight.tasks.delete(await Promise.race(flight.tasks.values()));
	}

	const report = finishDrain({ context, state });

	recordBoard({ context, state });

	return report;
};
