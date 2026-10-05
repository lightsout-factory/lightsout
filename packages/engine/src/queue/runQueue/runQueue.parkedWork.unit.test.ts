import { describe, expect, jest, test } from '@jest/globals';
import type { TicketSummary } from '#src/common/types/TicketSummary.ts';
import type { TrackerSettings } from '#src/common/types/TrackerSettings.ts';
import type { WorkOrderRunOutcome } from '#src/common/types/WorkOrderRunOutcome.ts';
import type { NamedWorkOrder } from '#src/queue/common/types/NamedWorkOrder.ts';
import type { ParkedWork } from '#src/queue/common/types/ParkedWork.ts';
import type { QueueFailure } from '#src/queue/common/types/QueueFailure.ts';
import type { nameWaveWorkOrders } from '#src/queue/drainLanes/runDrainLanes/common/admitScanned/nameWaveWorkOrders.ts';
import { nameWaveLikeTemplate } from '#tests/helpers/nameWaveLikeTemplate.ts';
import { queueOutcomeFixture as outcomeOf } from '#tests/helpers/queueOutcomeFixture.ts';
import { queueTicketFixture as ticketOf } from '#tests/helpers/queueTicketFixture.ts';
import { setupQueueDrain } from '#tests/helpers/setupQueueDrain.ts';

// Mocked Imports
// -------------------------
// The blocking half of the drain, which the base suite deliberately leaves
// alone: which tickets a wave may take and how often the tracker is re-read.
// What the report says about a ticket no wave ever worked is the neighbouring
// `runQueue.blockedTickets` suite. A blocker finishing mid-drain is expressed by
// the tracker stub answering a DIFFERENT eligible list on the next call.
const mockListEligibleTickets = jest.fn<() => Promise<TicketSummary[] | QueueFailure>>();
const mockScanParkedWorktrees = jest.fn<() => Promise<ParkedWork | QueueFailure>>();
const mockRunQueueTicket = jest.fn<(params: { workOrder: NamedWorkOrder }) => Promise<WorkOrderRunOutcome>>();
const mockShipOneBranch = jest.fn<(params: { outcome: WorkOrderRunOutcome }) => Promise<WorkOrderRunOutcome>>();
type LabelParams = { settings: TrackerSettings; ticketId: string; label: string | undefined; present: boolean };

const mockSetTicketLabel = jest.fn<(params: LabelParams) => Promise<QueueFailure | undefined>>();

jest.mock('#src/queue/ticketSelection/listEligibleTickets.ts', () => ({ listEligibleTickets: () => mockListEligibleTickets() }));
jest.mock('#src/ticketTracker/appendTicketNote.ts', () => ({ appendTicketNote: () => Promise.resolve(undefined) }));
jest.mock('#src/ticketTracker/listLabelNames.ts', () => ({
	listLabelNames: () =>
		Promise.resolve(['planning-needs-brainstorm', 'planning-needs-plan', 'planning-ready-auto-plan', 'planning-complete', 'planning-not-needed']),
}));
jest.mock('#src/ticketTracker/setTicketLabel.ts', () => ({ setTicketLabel: (params: LabelParams) => mockSetTicketLabel(params) }));
jest.mock('#src/queue/worktrees/scanParkedWorktrees/scanParkedWorktrees.ts', () => ({ scanParkedWorktrees: () => mockScanParkedWorktrees() }));
jest.mock('#src/queue/runQueue/runQueueWorkOrder/runQueueWorkOrder.ts', () => ({
	runQueueWorkOrder: (params: { workOrder: NamedWorkOrder }) => mockRunQueueTicket(params),
}));
jest.mock('#src/queue/drainLanes/runDrainLanes/startShip/shipOneBranch.ts', () => ({
	shipOneBranch: (params: { outcome: WorkOrderRunOutcome }) => mockShipOneBranch(params),
}));
// -------------------------
// Naming a wave creates work orders, which reads the tracker and spawns a
// harness — the work order module's own job, with its own tests. These cases
// keep the label and branch the queue's template renders, so what they state
// about branches and worktrees is what the drain itself decides.
const mockNameWaveWorkOrders = jest.fn<typeof nameWaveWorkOrders>(nameWaveLikeTemplate());

jest.mock('#src/queue/drainLanes/runDrainLanes/common/admitScanned/nameWaveWorkOrders.ts', () => ({
	nameWaveWorkOrders: (params: Parameters<typeof mockNameWaveWorkOrders>[0]) => mockNameWaveWorkOrders(params),
}));
// -------------------------

/**
 * A repo with a remote behind it and every collaborator stubbed green.
 *
 * `eligible` is what EVERY tracker read answers; a test that needs the backlog
 * to change between waves queues the earlier answers with `mockResolvedValueOnce`
 * on top of it, which is what a blocker finishing mid-drain looks like here.
 */
const setupDrain = ({ eligible = [], parked }: { eligible?: TicketSummary[]; parked?: ParkedWork } = {}) => {
	mockListEligibleTickets.mockResolvedValue(eligible);
	mockScanParkedWorktrees.mockResolvedValue(parked ?? { resumed: [], outcomes: [], leftBehind: [], merged: [] });
	mockRunQueueTicket.mockImplementation(({ workOrder: { ticket } }) => Promise.resolve(outcomeOf({ ticket })));
	mockShipOneBranch.mockImplementation(({ outcome }) => Promise.resolve(outcome));
	mockSetTicketLabel.mockResolvedValue(undefined);

	return setupQueueDrain();
};

/** The identifiers handed to a worker, in the order the waves picked them up. */
const pickedUp = () => mockRunQueueTicket.mock.calls.map((call) => call[0].workOrder.ticket.identifier);

/** The identifiers the serial merge lane took, in the order it merged them. Flat, because the lane now takes one branch per call. */
const merged = () => mockShipOneBranch.mock.calls.map((call) => call[0].outcome.ticket.identifier);

describe('runQueue', () => {
	test('merges a parked branch exactly once, so a later scan never ships settled work twice', async () => {
		const alreadyReady = outcomeOf({ ticket: ticketOf({ number: 99 }) });
		const { drain, relay } = setupDrain({ parked: { resumed: [], outcomes: [alreadyReady], leftBehind: [], merged: [] } });

		mockListEligibleTickets.mockResolvedValueOnce([ticketOf({ number: 70 }), ticketOf({ number: 71, unfinishedBlockers: ['LO-70'] })]);
		mockListEligibleTickets.mockResolvedValueOnce([ticketOf({ number: 71 })]);

		const report = await drain();

		relay.close();

		// The parked branch is merged once and never offered again; the flat list is
		// what says so, where the old per-wave grouping said it by shape.
		expect(merged()).toStrictEqual(['LO-99', 'LO-70', 'LO-71']);
		expect(report).toEqual({
			outcomes: [
				expect.objectContaining({ ticket: expect.objectContaining({ identifier: 'LO-99' }) }),
				expect.objectContaining({ ticket: expect.objectContaining({ identifier: 'LO-70' }) }),
				expect.objectContaining({ ticket: expect.objectContaining({ identifier: 'LO-71' }) }),
			],
			leftBehind: [],
		});
	});

	test('never re-runs a ticket the resume scan already finished, though a later scan hands it back', async () => {
		const alreadyReady = outcomeOf({ ticket: ticketOf({ number: 99 }) });
		const { drain, relay } = setupDrain({ parked: { resumed: [], outcomes: [alreadyReady], leftBehind: [], merged: [] } });

		mockListEligibleTickets.mockResolvedValueOnce([ticketOf({ number: 70 }), ticketOf({ number: 71, unfinishedBlockers: ['LO-70'] })]);
		mockListEligibleTickets.mockResolvedValueOnce([ticketOf({ number: 99 }), ticketOf({ number: 71 })]);

		await drain();
		relay.close();

		expect(pickedUp()).toStrictEqual(['LO-70', 'LO-71']);
	});

	test('never offers a worktree recorded merged to a later wave, though the tracker lists its ticket again', async () => {
		const settledTree = { worktreePath: '/tmp/worktrees/LO-99', branch: 'lo-99-ticket-id-99', ticket: ticketOf({ number: 99 }) };
		const { drain, relay } = setupDrain({ parked: { resumed: [], outcomes: [], leftBehind: [], merged: [settledTree] } });

		mockListEligibleTickets.mockResolvedValueOnce([ticketOf({ number: 70 }), ticketOf({ number: 71, unfinishedBlockers: ['LO-70'] })]);
		mockListEligibleTickets.mockResolvedValueOnce([ticketOf({ number: 99 }), ticketOf({ number: 71 })]);

		const report = await drain();

		relay.close();

		// The drain settles it before the first wave, so it is attempted from the
		// start — a tracker that hands it back cannot buy it a worker.
		expect(pickedUp()).toStrictEqual(['LO-70', 'LO-71']);
		expect(report).toEqual({
			outcomes: [
				expect.objectContaining({ ticket: expect.objectContaining({ identifier: 'LO-70' }) }),
				expect.objectContaining({ ticket: expect.objectContaining({ identifier: 'LO-71' }) }),
			],
			leftBehind: [
				{
					identifier: 'LO-99',
					title: 'Ticket 99',
					url: 'https://linear.app/lightsout/issue/LO-99',
					reason: expect.stringContaining('held a branch already recorded merged'),
					settled: true,
				},
			],
		});
	});

	test('carries a worktree the resume scan left behind through every wave, and names it exactly once', async () => {
		const withdrawn = { identifier: 'LO-98', reason: 'its worktree is parked, but the ticket carries no planning status label any more' };
		const { drain, relay } = setupDrain({ parked: { resumed: [], outcomes: [], leftBehind: [withdrawn], merged: [] } });

		mockListEligibleTickets.mockResolvedValueOnce([ticketOf({ number: 70 }), ticketOf({ number: 71, unfinishedBlockers: ['LO-70'] })]);
		mockListEligibleTickets.mockResolvedValueOnce([ticketOf({ number: 98 }), ticketOf({ number: 71 })]);

		const report = await drain();

		relay.close();

		expect(pickedUp()).toStrictEqual(['LO-70', 'LO-71']);
		expect(report).toEqual({
			outcomes: [
				expect.objectContaining({ ticket: expect.objectContaining({ identifier: 'LO-70' }) }),
				expect.objectContaining({ ticket: expect.objectContaining({ identifier: 'LO-71' }) }),
			],
			leftBehind: [withdrawn],
		});
	});

	test('scans the parked worktrees once for the whole invocation, so a parked ticket is never re-resumed to re-ask its question', async () => {
		const { drain, relay } = setupDrain();

		mockListEligibleTickets.mockResolvedValueOnce([ticketOf({ number: 70 }), ticketOf({ number: 71, unfinishedBlockers: ['LO-70'] })]);
		mockListEligibleTickets.mockResolvedValueOnce([ticketOf({ number: 71 })]);

		await drain();
		relay.close();

		expect(mockScanParkedWorktrees).toHaveBeenCalledTimes(1);
	});
});
