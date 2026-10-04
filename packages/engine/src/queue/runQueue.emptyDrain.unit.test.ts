import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, expect, jest, test } from '@jest/globals';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig/LightsoutConfig.ts';
import type { RunManifest } from '#src/contracts/run/RunManifest.ts';
import type { Driver } from '#src/drivers/common/types/Driver.ts';
import type { QueueFailure } from '#src/queue/common/types/QueueFailure.ts';
import type { TicketSummary } from '#src/queue/common/types/TicketSummary.ts';
import type { ParkedWork } from '#src/queue/internal/common/types/ParkedWork.ts';
import { runQueue } from '#src/queue/runQueue.ts';
import { readRunLock } from '#src/runState/lock/readRunLock.ts';
import { queueSettingsFixture } from '#tests/helpers/queueSettingsFixture.ts';
import { queueTicketFixture as ticketOf } from '#tests/helpers/queueTicketFixture.ts';
import { runDirFor } from '#tests/helpers/runDirFor.ts';
import { setupBranchRepo } from '#tests/helpers/setupBranchRepo.ts';
import { shipSettingsFixture } from '#tests/helpers/shipSettingsFixture.ts';
import { terminalRelayFixture } from '#tests/helpers/terminalRelayFixture.ts';
import { trackerSettingsFixture } from '#tests/helpers/trackerSettingsFixture.ts';

// Mocked Imports
// -------------------------
// The tracker and the parked scan are each covered by their own tests. What this
// file owns is whether a drain with nothing to do leaves a queue run on disk —
// observable with the backlog and the parked worktrees stubbed empty.
const mockListEligibleTickets = jest.fn<() => Promise<TicketSummary[] | QueueFailure>>();
const mockScanParkedWorktrees = jest.fn<() => Promise<ParkedWork | QueueFailure>>();

jest.mock('#src/queue/ticketSelection/listEligibleTickets.ts', () => ({ listEligibleTickets: () => mockListEligibleTickets() }));
jest.mock('#src/ticketTracker/appendTicketNote.ts', () => ({ appendTicketNote: () => Promise.resolve(undefined) }));
jest.mock('#src/ticketTracker/listLabelNames.ts', () => ({
	listLabelNames: () =>
		Promise.resolve(['planning-needs-brainstorm', 'planning-needs-plan', 'planning-ready-auto-plan', 'planning-complete', 'planning-not-needed']),
}));
jest.mock('#src/queue/worktrees/scanParkedWorktrees.ts', () => ({ scanParkedWorktrees: () => mockScanParkedWorktrees() }));
// -------------------------

/**
 * A repo with a remote behind it and a backlog with nothing runnable in it.
 *
 * `eligible` is what the tracker answers; a ticket held back by an unfinished
 * blocker is how an unsettled ticket left behind is arranged.
 */
const setupEmptyDrain = ({ eligible }: { eligible: TicketSummary[] }) => {
	mockListEligibleTickets.mockResolvedValue(eligible);
	mockScanParkedWorktrees.mockResolvedValue({ resumed: [], outcomes: [], leftBehind: [], merged: [] });

	const { cwd } = setupBranchRepo();
	const config: LightsoutConfig = { gates: { check: 'true', test: 'true', 'test-coverage': false } };
	const driver: Driver = { name: 'claude-code', invoke: () => Promise.resolve({ text: '', exitCode: 0 }) };
	const relay = terminalRelayFixture();

	return { cwd, config, driver, relay };
};

/** Every queue run on disk, by id and recorded status — an empty list when the drain created no queue runs folder at all. */
const readQueueRuns = ({ cwd }: { cwd: string }) => {
	const runsDir = dirname(runDirFor({ cwd, runId: 'any', pipeline: 'queue' }));

	if (!existsSync(runsDir)) {
		return [];
	}

	return readdirSync(runsDir).map((runId) => {
		const manifest = JSON.parse(readFileSync(join(runsDir, runId, 'manifest.json'), 'utf8')) as RunManifest;

		return { runId: manifest.runId, status: manifest.status };
	});
};

describe('runQueue', () => {
	test.each([
		{ recordEmptyDrain: true, eligible: [], runs: [{ runId: 'queue-run-1', status: 'passed' }] },
		{ recordEmptyDrain: true, eligible: [ticketOf({ number: 70, unfinishedBlockers: ['LO-69'] })], runs: [{ runId: 'queue-run-1', status: 'escalated' }] },
		{ recordEmptyDrain: false, eligible: [], runs: [] },
	])('runQueue: a detached empty drain still records its queue run, and a foreground one creates none', async ({ recordEmptyDrain, eligible, runs }) => {
		const { cwd, config, driver, relay } = setupEmptyDrain({ eligible });

		const report = await runQueue({
			cwd,
			runId: 'queue-run-1',
			recordEmptyDrain,
			settings: queueSettingsFixture(),
			trackerSettings: trackerSettingsFixture(),
			shipSettings: shipSettingsFixture(),
			config,
			loadedConfig: { config },
			env: {},
			driver,
			driverName: 'claude-code',
			relay,
		});

		relay.close();

		const recorded = readQueueRuns({ cwd });
		const lock = await readRunLock({ cwd });

		expect({ outcomes: 'outcomes' in report ? report.outcomes : report, runs: recorded, lock }).toStrictEqual({
			outcomes: [],
			runs,
			lock: undefined,
		});
	});
});
