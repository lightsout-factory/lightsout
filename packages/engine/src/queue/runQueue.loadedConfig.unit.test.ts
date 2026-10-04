import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, expect, jest, test } from '@jest/globals';
import type { Driver } from '#src/common/types/Driver.ts';
import type { LoadedConfig } from '#src/common/types/LoadedConfig.ts';
import type { TrackerSettings } from '#src/common/types/TrackerSettings.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig/LightsoutConfig.ts';
import type { RunManifest } from '#src/contracts/run/RunManifest.ts';
import type { NamedWorkOrder } from '#src/queue/common/types/NamedWorkOrder.ts';
import type { QueueFailure } from '#src/queue/common/types/QueueFailure.ts';
import type { TicketSummary } from '#src/queue/common/types/TicketSummary.ts';
import type { WorkOrderRunOutcome } from '#src/queue/common/types/WorkOrderRunOutcome.ts';
import type { ParkedWork } from '#src/queue/internal/common/types/ParkedWork.ts';
import type { nameWaveWorkOrders } from '#src/queue/nameWaveWorkOrders.ts';
import { runQueue } from '#src/queue/runQueue.ts';
import { nameWaveLikeTemplate } from '#tests/helpers/nameWaveLikeTemplate.ts';
import { queueOutcomeFixture as outcomeOf } from '#tests/helpers/queueOutcomeFixture.ts';
import { queueSettingsFixture } from '#tests/helpers/queueSettingsFixture.ts';
import { queueTicketFixture as ticketOf } from '#tests/helpers/queueTicketFixture.ts';
import { runDirFor } from '#tests/helpers/runDirFor.ts';
import { setupBranchRepo } from '#tests/helpers/setupBranchRepo.ts';
import { shipSettingsFixture } from '#tests/helpers/shipSettingsFixture.ts';
import { terminalRelayFixture } from '#tests/helpers/terminalRelayFixture.ts';
import { trackerSettingsFixture } from '#tests/helpers/trackerSettingsFixture.ts';

// Mocked Imports
// -------------------------
// The tracker, the per-ticket run and the serial merge are each covered by their
// own tests. What this file owns is which config the coordinator records and
// which config the drain hands every ticket — observable with those stubbed.
type WorkOrderParams = { workOrder: NamedWorkOrder; loadedConfig: LoadedConfig };
type LabelParams = { settings: TrackerSettings; ticketId: string; label: string | undefined; present: boolean };

const mockListEligibleTickets = jest.fn<() => Promise<TicketSummary[] | QueueFailure>>();
const mockScanParkedWorktrees = jest.fn<() => Promise<ParkedWork | QueueFailure>>();
const mockRunQueueWorkOrder = jest.fn<(params: WorkOrderParams) => Promise<WorkOrderRunOutcome>>();
const mockShipOneBranch = jest.fn<(params: { outcome: WorkOrderRunOutcome }) => Promise<WorkOrderRunOutcome>>();
const mockSetTicketLabel = jest.fn<(params: LabelParams) => Promise<QueueFailure | undefined>>();

jest.mock('#src/queue/ticketSelection/listEligibleTickets.ts', () => ({ listEligibleTickets: () => mockListEligibleTickets() }));
jest.mock('#src/ticketTracker/appendTicketNote.ts', () => ({ appendTicketNote: () => Promise.resolve(undefined) }));
jest.mock('#src/ticketTracker/listLabelNames.ts', () => ({
	listLabelNames: () =>
		Promise.resolve(['planning-needs-brainstorm', 'planning-needs-plan', 'planning-ready-auto-plan', 'planning-complete', 'planning-not-needed']),
}));
jest.mock('#src/ticketTracker/setTicketLabel.ts', () => ({ setTicketLabel: (params: LabelParams) => mockSetTicketLabel(params) }));
jest.mock('#src/queue/worktrees/scanParkedWorktrees.ts', () => ({ scanParkedWorktrees: () => mockScanParkedWorktrees() }));
jest.mock('#src/queue/internal/runQueueWorkOrder.ts', () => ({ runQueueWorkOrder: (params: WorkOrderParams) => mockRunQueueWorkOrder(params) }));
jest.mock('#src/queue/internal/shipOneBranch.ts', () => ({ shipOneBranch: (params: { outcome: WorkOrderRunOutcome }) => mockShipOneBranch(params) }));
// -------------------------
// Naming a wave creates work orders, which reads the tracker and spawns a
// harness — the work order module's own job, with its own tests.
const mockNameWaveWorkOrders = jest.fn<typeof nameWaveWorkOrders>(nameWaveLikeTemplate());

jest.mock('#src/queue/nameWaveWorkOrders.ts', () => ({
	nameWaveWorkOrders: (params: Parameters<typeof mockNameWaveWorkOrders>[0]) => mockNameWaveWorkOrders(params),
}));
// -------------------------

/**
 * A repo with a remote behind it and a `lightsout.config.json` in the launching
 * checkout, the queue's startup config as read from it, and a stamped config
 * whose harness differs from the file's.
 *
 * The first ticket a builder takes rewrites the file with a different gate, which
 * is what a config edited after the drain started looks like.
 */
const setupLoadedConfigDrain = ({ eligible }: { eligible: TicketSummary[] }) => {
	const { cwd } = setupBranchRepo();
	const configPath = join(cwd, 'lightsout.config.json');
	const asRead: LightsoutConfig = { harness: 'codex', gates: { check: 'pnpm check', test: 'true', 'test-coverage': false } };
	const rewritten: LightsoutConfig = { harness: 'codex', gates: { check: 'pnpm check:edited', test: 'true', 'test-coverage': false } };
	const loadedConfig: LoadedConfig = { config: asRead, path: configPath };
	const config: LightsoutConfig = { ...asRead, harness: 'claude-code', model: 'stamped-model' };
	const driver: Driver = { name: 'claude-code', invoke: () => Promise.resolve({ text: '', exitCode: 0 }) };
	const relay = terminalRelayFixture();

	writeFileSync(configPath, JSON.stringify(asRead));
	mockListEligibleTickets.mockResolvedValue(eligible);
	mockScanParkedWorktrees.mockResolvedValue({ resumed: [], outcomes: [], leftBehind: [], merged: [] });
	mockRunQueueWorkOrder.mockImplementation(({ workOrder: { ticket } }) => {
		writeFileSync(configPath, JSON.stringify(rewritten));

		return Promise.resolve(outcomeOf({ ticket }));
	});
	mockShipOneBranch.mockImplementation(({ outcome }) => Promise.resolve(outcome));
	mockSetTicketLabel.mockResolvedValue(undefined);

	return { cwd, configPath, asRead, loadedConfig, config, driver, relay };
};

/** The one manifest the drain's coordinator run wrote. */
const readCoordinatorManifest = ({ cwd }: { cwd: string }) => {
	const runsDir = dirname(runDirFor({ cwd, runId: 'any', pipeline: 'queue' }));
	const runId = readdirSync(runsDir)[0];

	return JSON.parse(readFileSync(join(runsDir, runId, 'manifest.json'), 'utf8')) as RunManifest;
};

describe('runQueue', () => {
	test("an empty recorded drain's coordinator run records the queue's loaded config", async () => {
		const { cwd, configPath, asRead, loadedConfig, config, driver, relay } = setupLoadedConfigDrain({ eligible: [] });

		await runQueue({
			cwd,
			runId: 'queue-run-1',
			recordEmptyDrain: true,
			settings: queueSettingsFixture(),
			trackerSettings: trackerSettingsFixture(),
			shipSettings: shipSettingsFixture(),
			config,
			loadedConfig,
			env: {},
			driver,
			driverName: 'claude-code',
			relay,
		});

		relay.close();

		const manifest = readCoordinatorManifest({ cwd });

		expect({ config: manifest.config, configPath: manifest.configPath }).toStrictEqual({ config: asRead, configPath });
	});

	test('every ticket of one drain receives the startup loaded config, whatever the file says later', async () => {
		const { cwd, configPath, asRead, loadedConfig, config, driver, relay } = setupLoadedConfigDrain({
			eligible: [ticketOf({ number: 70 }), ticketOf({ number: 71 })],
		});

		await runQueue({
			cwd,
			runId: 'queue-run-1',
			settings: queueSettingsFixture(),
			trackerSettings: trackerSettingsFixture(),
			shipSettings: shipSettingsFixture(),
			config,
			loadedConfig,
			env: {},
			driver,
			driverName: 'claude-code',
			relay,
		});

		relay.close();

		const manifest = readCoordinatorManifest({ cwd });
		const handedToTickets = mockRunQueueWorkOrder.mock.calls.map(([params]) => ({
			ticket: params.workOrder.ticket.identifier,
			loadedConfig: params.loadedConfig,
		}));

		expect({ recorded: { config: manifest.config, configPath: manifest.configPath }, handedToTickets }).toStrictEqual({
			recorded: { config: asRead, configPath },
			handedToTickets: [
				{ ticket: 'LO-70', loadedConfig: { config: asRead, path: configPath } },
				{ ticket: 'LO-71', loadedConfig: { config: asRead, path: configPath } },
			],
		});
	});
});
