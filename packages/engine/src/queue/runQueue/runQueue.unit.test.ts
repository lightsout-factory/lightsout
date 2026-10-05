import { existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { describe, expect, jest, test } from '@jest/globals';
import { PlanningStatus } from '#src/common/constants/PlanningStatus.ts';
import { QueueWorker } from '#src/common/constants/QueueWorker.ts';
import type { TicketSummary } from '#src/common/types/TicketSummary.ts';
import type { TrackerSettings } from '#src/common/types/TrackerSettings.ts';
import type { WorkOrderRunOutcome } from '#src/common/types/WorkOrderRunOutcome.ts';
import type { NamedWorkOrder } from '#src/queue/common/types/NamedWorkOrder.ts';
import type { ParkedWork } from '#src/queue/common/types/ParkedWork.ts';
import type { QueueFailure } from '#src/queue/common/types/QueueFailure.ts';
import type { nameWaveWorkOrders } from '#src/queue/drainLanes/runDrainLanes/common/admitScanned/nameWaveWorkOrders.ts';
import { jiraTrackerSettingsFixture } from '#tests/helpers/jiraQueueSettingsFixture.ts';
import { nameWaveLikeTemplate } from '#tests/helpers/nameWaveLikeTemplate.ts';
import { queueOutcomeFixture as outcomeOf } from '#tests/helpers/queueOutcomeFixture.ts';
import { queueSettingsFixture } from '#tests/helpers/queueSettingsFixture.ts';
import { queueTicketFixture as ticketOf } from '#tests/helpers/queueTicketFixture.ts';
import { runDirFor } from '#tests/helpers/runDirFor.ts';
import { setupQueueDrain } from '#tests/helpers/setupQueueDrain.ts';
import { shipSettingsFixture } from '#tests/helpers/shipSettingsFixture.ts';

// Mocked Imports
// -------------------------
// The tracker, the per-ticket run and the serial merge are each covered by their
// own tests. What this file owns is the order the drain works in, what it writes
// down, and the accounting it hands back — all observable with those stubbed.
/** The queue-owned chain every `git worktree add` goes through, as `runQueueWorkOrder` receives it. */
type SerializeWorktreeAdd = <Result>(params: { task: () => Promise<Result> }) => Promise<Result>;

const mockListEligibleTickets = jest.fn<() => Promise<TicketSummary[] | QueueFailure>>();
const mockScanParkedWorktrees = jest.fn<() => Promise<ParkedWork | QueueFailure>>();
const mockRunQueueTicket = jest.fn<(params: { workOrder: NamedWorkOrder; serializeWorktreeAdd: SerializeWorktreeAdd }) => Promise<WorkOrderRunOutcome>>();
const mockShipOneBranch = jest.fn<(params: { outcome: WorkOrderRunOutcome }) => Promise<WorkOrderRunOutcome>>();
/** The label write is covered by `setTicketLabel`'s own tests; what this file owns is which list the drain settles it over, and when. */
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
	runQueueWorkOrder: (params: { workOrder: NamedWorkOrder; serializeWorktreeAdd: SerializeWorktreeAdd }) => mockRunQueueTicket(params),
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

const shipSettings = shipSettingsFixture();

/** A repo with a remote behind it and every collaborator stubbed green. */
const setupDrain = ({ eligible = [], parked }: { eligible?: TicketSummary[]; parked?: ParkedWork } = {}) => {
	mockListEligibleTickets.mockResolvedValue(eligible);
	mockScanParkedWorktrees.mockResolvedValue(parked ?? { resumed: [], outcomes: [], leftBehind: [], merged: [] });
	mockRunQueueTicket.mockImplementation(({ workOrder: { ticket } }) => Promise.resolve(outcomeOf({ ticket })));
	mockShipOneBranch.mockImplementation(({ outcome }) => Promise.resolve(outcome));
	mockSetTicketLabel.mockResolvedValue(undefined);

	return setupQueueDrain();
};

describe('runQueue', () => {
	test('refuses a branch template the ship pattern cannot read, naming both keys before any ticket is built', async () => {
		const { drain, relay } = setupDrain();

		const report = await drain({ settings: queueSettingsFixture({ branchTemplate: 'work/{slug}' }) });

		relay.close();

		expect(report).toEqual({ error: expect.stringContaining('`queue.branch-template`') });
		expect(report).toEqual({ error: expect.stringContaining('`ship.ticket-pattern`') });
	});

	test('starts under a ticket pattern scoped to the configured team, because the sample ticket is shaped from that team key', async () => {
		const { drain, relay } = setupDrain();

		const report = await drain({ ship: { ...shipSettings, ticketPattern: /^(?<ticket>lo-(?<number>\d+))/ } });

		relay.close();

		expect(report).toStrictEqual({ outcomes: [], leftBehind: [] });
	});

	test('starts Jira under a ticket pattern scoped to its ticket prefix', async () => {
		const { drain, relay } = setupDrain();

		const report = await drain({
			trackerSettings: jiraTrackerSettingsFixture({ project: 'OPS', ticketPrefix: 'OPS' }),
			ship: { ...shipSettings, ticketPattern: /^(?<ticket>ops-(?<number>\d+))/ },
		});

		relay.close();

		expect(report).toStrictEqual({ outcomes: [], leftBehind: [] });
	});

	test('refuses a repo with no remote default branch, the same refusal ship makes for the same reason', async () => {
		const { drain, relay } = setupQueueDrain({ repo: { remoteHead: false } });

		const report = await drain();

		relay.close();

		expect(report).toEqual({ error: expect.stringContaining('origin/HEAD') });
	});

	test('says there is nothing to do and leaves no run behind when the backlog is dry and no worktree is parked', async () => {
		const { cwd, drain, relay, progress } = setupDrain();

		const report = await drain();

		relay.close();

		expect(report).toStrictEqual({ outcomes: [], leftBehind: [] });
		expect(progress).toEqual([expect.stringContaining('nothing to do')]);
		expect(existsSync(dirname(runDirFor({ cwd, runId: 'any', pipeline: 'queue' })))).toBe(false);
	});

	test('still names a worktree the resume scan left behind when there is nothing to drain, so it never vanishes from the summary', async () => {
		const withdrawn = { identifier: 'LO-99', reason: 'its worktree is parked, but the ticket carries no planning status label any more' };
		const { drain, relay } = setupDrain({ parked: { resumed: [], outcomes: [], leftBehind: [withdrawn], merged: [] } });

		const report = await drain();

		relay.close();

		expect(report).toStrictEqual({ outcomes: [], leftBehind: [withdrawn] });
	});

	test('hands a tracker failure back rather than draining what it managed to read', async () => {
		const { drain, relay } = setupDrain();

		mockListEligibleTickets.mockResolvedValue({ error: 'authentication failed' });

		expect(await drain()).toStrictEqual({ error: 'authentication failed' });

		relay.close();
	});

	test('hands a failed resume scan back too, so a restart stops rather than re-running parked work blind', async () => {
		const { drain, relay } = setupDrain({ eligible: [ticketOf({ number: 70 })] });

		mockScanParkedWorktrees.mockResolvedValue({ error: 'the tracker did not answer' });

		expect(await drain()).toStrictEqual({ error: 'the tracker did not answer' });

		relay.close();
	});

	test('works urgent tickets before low ones, and the oldest first within a priority', async () => {
		const { drain, relay } = setupDrain({
			eligible: [
				ticketOf({ number: 70, priority: 0 }),
				ticketOf({ number: 71, priority: 3, createdAt: '2026-03-01T00:00:00.000Z' }),
				ticketOf({ number: 72, priority: 1 }),
				ticketOf({ number: 73, priority: 3, createdAt: '2026-02-01T00:00:00.000Z' }),
				ticketOf({ number: 74, priority: 5 }),
			],
		});

		await drain({ settings: queueSettingsFixture({ maxParallel: 1 }) });
		relay.close();

		expect(mockRunQueueTicket.mock.calls.map((call) => call[0].workOrder.ticket.identifier)).toStrictEqual(['LO-72', 'LO-73', 'LO-71', 'LO-74', 'LO-70']);
	});

	test('picks up parked tickets before any new one, because a restart is the resume path', async () => {
		const { drain, relay } = setupDrain({
			eligible: [ticketOf({ number: 70 })],
			parked: { resumed: [ticketOf({ number: 99 })], outcomes: [], leftBehind: [], merged: [] },
		});

		await drain({ settings: queueSettingsFixture({ maxParallel: 1 }) });
		relay.close();

		expect(mockRunQueueTicket.mock.calls.map((call) => call[0].workOrder.ticket.identifier)).toStrictEqual(['LO-99', 'LO-70']);
	});

	test("hands the wave's naming step the drain's own harness, so a queued work order is named the way `work-order new` names one", async () => {
		const { cwd, driver, drain, relay } = setupDrain({ eligible: [ticketOf({ number: 70 })] });

		await drain();
		relay.close();

		expect(mockNameWaveWorkOrders).toHaveBeenCalledWith(expect.objectContaining({ cwd, driver, tickets: [ticketOf({ number: 70 })] }));
	});

	test('never builds a ticket the naming step left behind, and names it in the report', async () => {
		const workable = ticketOf({ number: 70 });
		const refused = ticketOf({ number: 71 });
		const { drain, relay } = setupDrain({ eligible: [workable, refused] });

		mockNameWaveWorkOrders.mockResolvedValueOnce({
			named: [{ ticket: workable, name: 'lo-70-alpha', branch: 'feature/lo-70-alpha' }],
			leftBehind: [{ identifier: 'LO-71', title: refused.title, url: refused.url, reason: 'lo-71-beta already names a work order' }],
		});

		const report = await drain();

		relay.close();

		expect(mockRunQueueTicket.mock.calls.map((call) => call[0].workOrder)).toStrictEqual([
			{ ticket: workable, name: 'lo-70-alpha', branch: 'feature/lo-70-alpha' },
		]);
		expect(report).toEqual({
			outcomes: [expect.objectContaining({ ticket: expect.objectContaining({ identifier: 'LO-70' }) })],
			leftBehind: [{ identifier: 'LO-71', title: 'Ticket 71', url: refused.url, reason: 'lo-71-beta already names a work order' }],
		});
	});

	test('sends both the parked-and-ready branches and the freshly built ones to the merge, in the order they became ready', async () => {
		const alreadyReady = outcomeOf({ ticket: ticketOf({ number: 99 }) });
		const { drain, relay } = setupDrain({
			eligible: [ticketOf({ number: 70 })],
			parked: { resumed: [], outcomes: [alreadyReady], leftBehind: [], merged: [] },
		});

		await drain();
		relay.close();

		expect(mockShipOneBranch.mock.calls.map(([params]) => params.outcome.ticket.identifier)).toStrictEqual(['LO-99', 'LO-70']);
	});

	test('merges a parked branch that only needed shipping, without spending a worker on finished work', async () => {
		const alreadyReady = outcomeOf({ ticket: ticketOf({ number: 99 }) });
		const { drain, relay } = setupDrain({ parked: { resumed: [], outcomes: [alreadyReady], leftBehind: [], merged: [] } });

		const report = await drain();

		relay.close();

		expect(mockRunQueueTicket).not.toHaveBeenCalled();
		expect(report).toStrictEqual({ outcomes: [alreadyReady], leftBehind: [] });
	});

	test('lets only one ticket create a worktree at a time, because that step mutates the main checkout they share', async () => {
		const { drain, relay } = setupDrain({ eligible: [ticketOf({ number: 70 }), ticketOf({ number: 71 })] });
		let creating = 0;
		let mostAtOnce = 0;

		mockRunQueueTicket.mockImplementation(async ({ workOrder: { ticket }, serializeWorktreeAdd }) => {
			await serializeWorktreeAdd({
				task: async () => {
					creating += 1;
					mostAtOnce = Math.max(mostAtOnce, creating);

					await new Promise((settle) => setTimeout(settle, 5));

					creating -= 1;
				},
			});

			return outcomeOf({ ticket });
		});

		await drain({ settings: queueSettingsFixture({ maxParallel: 2 }) });
		relay.close();

		expect(mockRunQueueTicket).toHaveBeenCalledTimes(2);
		expect(mostAtOnce).toBe(1);
	});

	test('carries a skipped ticket into the report beside the outcomes, so nothing vanishes from the summary', async () => {
		const { drain, relay } = setupDrain({
			eligible: [ticketOf({ number: 70 }), { ...ticketOf({ number: 70 }), planningStatus: PlanningStatus.Complete, worker: QueueWorker.Plan }],
			parked: { resumed: [], outcomes: [outcomeOf({ ticket: ticketOf({ number: 99 }) })], leftBehind: [], merged: [] },
		});

		const report = await drain();

		relay.close();

		expect(report).toEqual({
			outcomes: [expect.objectContaining({ ticket: expect.objectContaining({ identifier: 'LO-99' }) })],
			leftBehind: [
				{
					identifier: 'LO-70',
					title: 'Ticket 70',
					url: 'https://linear.app/lightsout/issue/LO-70',
					reason: expect.stringContaining('planning status labels'),
				},
			],
		});
	});
});
