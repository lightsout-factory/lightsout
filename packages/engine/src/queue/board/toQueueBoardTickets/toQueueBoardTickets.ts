import { join } from 'node:path';
import type { LeftBehindTicket } from '#src/common/types/LeftBehindTicket.ts';
import type { QueueDrainReport } from '#src/common/types/QueueDrainReport.ts';
import type { TicketSummary } from '#src/common/types/TicketSummary.ts';
import type { WorkOrderRunOutcome } from '#src/common/types/WorkOrderRunOutcome.ts';
import type { QueueBoardTicket } from '#src/contracts/queue/QueueBoardTicket.ts';
import { QueueLane } from '#src/contracts/queue/QueueLane.ts';
import type { LiveQueueBoard } from '#src/queue/board/toQueueBoardTickets/LiveQueueBoard.ts';
import type { BuildInFlight } from '#src/queue/common/types/BuildInFlight.ts';
import type { NamedWorkOrder } from '#src/queue/common/types/NamedWorkOrder.ts';

interface Params {
	/** Outcomes and left-behind entries the drain has settled. With nothing else, this is the final board. */
	settled: QueueDrainReport;
	live?: LiveQueueBoard;
	/** ISO time of the snapshot: the entry time of every ticket that has just entered its lane. */
	at: string;
}

type Placed = Omit<QueueBoardTicket, 'enteredAt'>;

const describeWork = ({ ticket, name, branch, worktreePath }: { ticket: TicketSummary; name: string; branch: string; worktreePath: string }) => ({
	identifier: ticket.identifier,
	title: ticket.title,
	url: ticket.url,
	worker: ticket.worker,
	workOrderName: name,
	branch,
	worktreePath,
});

/** Branch and worktree are read off the record rather than rendered from a template. */
const describeUnbuilt = ({ workOrder, live }: { workOrder: NamedWorkOrder; live: LiveQueueBoard }) =>
	describeWork({ ticket: workOrder.ticket, name: workOrder.name, branch: workOrder.branch, worktreePath: join(live.worktreesRoot, workOrder.name) });

const placeLeftBehind = ({ entry, lane, reason }: { entry: LeftBehindTicket; lane: QueueLane; reason: string | undefined }) => ({
	identifier: entry.identifier,
	title: entry.title,
	url: entry.url,
	lane,
	reason,
});

const placeBuild = ({ build, live }: { build: BuildInFlight; live: LiveQueueBoard }) => {
	const question = live.questions.get(build.workOrder.ticket.identifier.toLowerCase());
	const work = { ...describeUnbuilt({ workOrder: build.workOrder, live }), buildStartedAt: build.startedAt };

	return question === undefined ? { ...work, lane: QueueLane.Building } : { ...work, lane: QueueLane.Blocked, reason: question, question };
};

const placeOutcome = ({ outcome }: { outcome: WorkOrderRunOutcome }) => {
	let lane: QueueLane;
	let reason: string | undefined;

	if (outcome.ready) {
		lane = QueueLane.Shipped;
		reason = outcome.reconciliationFailure;
	} else if (outcome.open === undefined) {
		lane = QueueLane.Parked;
		reason = outcome.error;
	} else {
		// Blocked rather than Parked: that lane already holds the tickets waiting on a
		// human, which is what an open ticket is waiting on.
		lane = QueueLane.Blocked;
		reason = outcome.open;
	}

	return { ...describeWork(outcome), lane, reason };
};

const placeSettled = ({ settled }: { settled: QueueDrainReport }) => [
	...settled.outcomes.map((outcome) => placeOutcome({ outcome })),
	...settled.leftBehind.map((entry) =>
		entry.settled === true
			? placeLeftBehind({ entry, lane: QueueLane.Shipped, reason: entry.reconciliationFailure })
			: placeLeftBehind({ entry, lane: QueueLane.Blocked, reason: entry.reason }),
	),
];

/** The live lanes, in the order a record claims its ticket when two name the same one. */
const placeLive = ({ live }: { live: LiveQueueBoard }) => [
	...(live.shipping === undefined ? [] : [{ ...describeWork(live.shipping), lane: QueueLane.ShippingNow }]),
	...live.readyToShip.map((outcome) => ({ ...describeWork(outcome), lane: QueueLane.ShipQueue })),
	...live.building.map((build) => placeBuild({ build, live })),
	...live.pending.map((workOrder) => ({ ...describeUnbuilt({ workOrder, live }), lane: QueueLane.BuildQueue })),
	...live.blocked.map((entry) => placeLeftBehind({ entry, lane: QueueLane.Blocked, reason: entry.reason })),
];

const toEnteredAt = ({ ticket, live, at }: { ticket: Placed; live: LiveQueueBoard | undefined; at: string }) => {
	const entered = live?.entered.get(ticket.identifier.toLowerCase());

	return entered !== undefined && entered.lane === ticket.lane ? entered.at : at;
};

/**
 * When two records name one ticket, the first in `placeSettled` then `placeLive` order places it.
 * Pure: the caller passes the clock as `at`, so one snapshot's board is the same however often
 * it is drawn.
 */
export const toQueueBoardTickets = ({ settled, live, at }: Params): QueueBoardTicket[] => {
	const records: Placed[] = [...placeSettled({ settled }), ...(live === undefined ? [] : placeLive({ live }))];
	const claimed = new Map<string, Placed>();

	for (const record of records) {
		const key = record.identifier.toLowerCase();

		if (!claimed.has(key)) {
			claimed.set(key, record);
		}
	}

	const kept = [...claimed.values()];
	const inColumnOrder = Object.values(QueueLane).flatMap((lane) => {
		const inLane = kept.filter((ticket) => ticket.lane === lane);

		// Question waits close Blocked, after every entry held back without one.
		return [...inLane.filter((ticket) => ticket.question === undefined), ...inLane.filter((ticket) => ticket.question !== undefined)];
	});

	return inColumnOrder.map((ticket) => ({ ...ticket, enteredAt: toEnteredAt({ ticket, live, at }) }));
};
