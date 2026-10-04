import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, expect, jest, test } from '@jest/globals';
import type { TicketSummary } from '#src/common/types/TicketSummary.ts';
import type { TrackerSettings } from '#src/common/types/TrackerSettings.ts';
import type { WorkOrderRunOutcome } from '#src/common/types/WorkOrderRunOutcome.ts';
import type { RunManifest } from '#src/contracts/run/RunManifest.ts';
import { RunStatus } from '#src/contracts/run/RunStatus.ts';
import type { NamedWorkOrder } from '#src/queue/common/types/NamedWorkOrder.ts';
import type { ParkedWork } from '#src/queue/common/types/ParkedWork.ts';
import type { QueueFailure } from '#src/queue/common/types/QueueFailure.ts';
import type { nameWaveWorkOrders } from '#src/queue/drainLanes/runDrainLanes/common/admitScanned/nameWaveWorkOrders.ts';
import { nameWaveLikeTemplate } from '#tests/helpers/nameWaveLikeTemplate.ts';
import { queueOutcomeFixture as outcomeOf } from '#tests/helpers/queueOutcomeFixture.ts';
import { queueTicketFixture as ticketOf } from '#tests/helpers/queueTicketFixture.ts';
import { runDirFor } from '#tests/helpers/runDirFor.ts';
import { setupQueueDrain } from '#tests/helpers/setupQueueDrain.ts';

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

/** A repo with a remote behind it and every collaborator stubbed green. */
const setupDrain = ({ eligible = [], parked }: { eligible?: TicketSummary[]; parked?: ParkedWork } = {}) => {
	mockListEligibleTickets.mockResolvedValue(eligible);
	mockScanParkedWorktrees.mockResolvedValue(parked ?? { resumed: [], outcomes: [], leftBehind: [], merged: [] });
	mockRunQueueTicket.mockImplementation(({ workOrder: { ticket } }) => Promise.resolve(outcomeOf({ ticket })));
	mockShipOneBranch.mockImplementation(({ outcome }) => Promise.resolve(outcome));
	mockSetTicketLabel.mockResolvedValue(undefined);

	return setupQueueDrain();
};

/** Two tickets — one the ship lane merges and one its worker leaves open — with the tracker credentials handed to the drain. */
const setupOpenDrain = ({ env }: { env: NodeJS.ProcessEnv }) => {
	const shipped = ticketOf({ number: 70 });
	const left = ticketOf({ number: 71 });

	mockListEligibleTickets.mockResolvedValue([shipped, left]);
	mockScanParkedWorktrees.mockResolvedValue({ resumed: [], outcomes: [], leftBehind: [], merged: [] });
	mockRunQueueTicket.mockImplementation(({ workOrder: { ticket } }) =>
		Promise.resolve(
			ticket.identifier === left.identifier
				? outcomeOf({ ticket, ready: false, open: 'no ship request names the plans this ticket includes' })
				: outcomeOf({ ticket }),
		),
	);
	mockShipOneBranch.mockImplementation(({ outcome }) => Promise.resolve(outcome));
	mockSetTicketLabel.mockResolvedValue(undefined);

	return setupQueueDrain({ env });
};

/** The one manifest the drain's coordinator run wrote. */
const readCoordinatorRun = ({ cwd }: { cwd: string }) => {
	const runsDir = dirname(runDirFor({ cwd, runId: 'any', pipeline: 'queue' }));
	const runId = readdirSync(runsDir)[0];
	const manifest = JSON.parse(readFileSync(join(runsDir, runId, 'manifest.json'), 'utf8')) as RunManifest;

	return { runId, manifest, planPath: join(runsDir, runId, 'queue.md') };
};

describe('runQueue', () => {
	test('records every ticket it will work in the coordinator run, naming the branch and the worktree a human can reach it in', async () => {
		const { cwd, drain, relay } = setupDrain({ eligible: [ticketOf({ number: 70 })] });

		await drain();
		relay.close();

		const { manifest, planPath } = readCoordinatorRun({ cwd });

		expect(manifest.pipeline).toBe('queue');
		expect(readFileSync(planPath, 'utf8')).toContain('LO-70 · direct · lo-70-ticket-70 ·');
	});

	test('records a branch cut to length for a ticket whose title offers no break point, rather than an over-long one', async () => {
		const longWord = ticketOf({ number: 71, title: 'Deterministicverificationpipelinerebuilds' });
		const { cwd, drain, relay } = setupDrain({ eligible: [longWord] });

		await drain();
		relay.close();

		expect(readFileSync(readCoordinatorRun({ cwd }).planPath, 'utf8')).toContain('LO-71 · direct · lo-71-deterministicverificationpipelinerebuild ·');
	});

	test('ends the coordinator run passed when everything shipped and nothing was left behind', async () => {
		const { cwd, drain, relay } = setupDrain({ eligible: [ticketOf({ number: 70 })] });

		await drain();
		relay.close();

		expect(readCoordinatorRun({ cwd }).manifest.status).toBe(RunStatus.Passed);
	});

	test('ends the coordinator run escalated when a ticket parked, because the factory still holds work', async () => {
		const { cwd, drain, relay } = setupDrain({ eligible: [ticketOf({ number: 70 })] });

		mockRunQueueTicket.mockImplementation(({ workOrder: { ticket } }) => Promise.resolve(outcomeOf({ ticket, ready: false, error: 'tsc: 3 errors' })));

		const report = await drain();

		relay.close();

		expect(report).toEqual({ outcomes: [expect.objectContaining({ ready: false })], leftBehind: [] });
		expect(readCoordinatorRun({ cwd }).manifest.status).toBe(RunStatus.Escalated);
	});

	test('runQueue: ends the coordinator run passed when the only unshipped ticket was left open', async () => {
		const { cwd, drain, relay } = setupOpenDrain({ env: { LINEAR_API_KEY: 'queue-token' } });

		await drain();
		relay.close();

		expect(readCoordinatorRun({ cwd }).manifest.status).toBe(RunStatus.Passed);
		expect(mockRunQueueTicket).toHaveBeenCalledWith(expect.objectContaining({ env: { LINEAR_API_KEY: 'queue-token' } }));
	});

	test('creates the coordinator run under the id its caller minted', async () => {
		const { cwd, drain, relay } = setupDrain();

		mockListEligibleTickets.mockResolvedValueOnce([]).mockResolvedValueOnce([ticketOf({ number: 70 })]);

		await drain({ runId: '0b7c1d2e-3f40-4a51-8b62-7c83d94ea5f6' });
		await drain({ runId: '9e8d7c6b-5a49-4382-9716-05f4e3d2c1b0' });
		relay.close();

		const { runId, manifest } = readCoordinatorRun({ cwd });
		const runIds = readdirSync(dirname(runDirFor({ cwd, runId, pipeline: 'queue' })));

		expect({ runIds, manifestRunId: manifest.runId }).toStrictEqual({ runIds: [runId], manifestRunId: '9e8d7c6b-5a49-4382-9716-05f4e3d2c1b0' });
	});
});
