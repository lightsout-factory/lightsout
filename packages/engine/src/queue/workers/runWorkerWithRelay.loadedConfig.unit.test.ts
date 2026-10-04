import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, jest, test } from '@jest/globals';
import { PlanningStatus } from '#src/common/constants/PlanningStatus.ts';
import type { Driver } from '#src/common/types/Driver.ts';
import type { LoadedConfig } from '#src/common/types/LoadedConfig.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig/LightsoutConfig.ts';
import { RunStatus } from '#src/contracts/run/RunStatus.ts';
import type { WorkOrderState } from '#src/contracts/workOrder/WorkOrderState.ts';
import type { runDirectWork } from '#src/direct/runDirectWork/runDirectWork.ts';
import { QueueWorker } from '#src/queue/common/constants/QueueWorker.ts';
import type { QuestionRelay } from '#src/queue/common/types/QuestionRelay.ts';
import type { RunnableTicket } from '#src/queue/internal/common/types/RunnableTicket.ts';
import type { buildWorkOrderPlans } from '#src/queue/workers/internal/buildWorkOrderPlans.ts';
import type { runAutoPlanWorker } from '#src/queue/workers/internal/runAutoPlanWorker.ts';
import { runWorkerWithRelay } from '#src/queue/workers/runWorkerWithRelay.ts';
import type { runWorkOrderBodyBuildLifecycle } from '#src/workOrder/implementRun/runWorkOrderBodyBuildLifecycle.ts';
import type { pullWorkOrderState } from '#src/workOrder/pullWorkOrderState.ts';
import { queueSettingsFixture } from '#tests/helpers/queueSettingsFixture.ts';

/**
 * The queue's loaded config — the config as it was read from disk at the
 * drain's start, before the command stamped its harness on it — as each worker
 * kind hands it on to whatever creates the ticket's runs.
 *
 * A sibling of `runWorkerWithRelay.unit.test.ts` rather than more cases in it:
 * that file states which worker a ticket gets and the question loop, while
 * every case here turns on the one value every worker must pass on unchanged.
 */

// Mocked Imports
// -------------------------
// Every worker ends in a pipeline or a harness — another module's entry point,
// each covered by its own tests. What this file owns is the hand-off to them.
const mockRunDirectWork = jest.fn<typeof runDirectWork>();

jest.mock('#src/direct/runDirectWork/runDirectWork.ts', () => ({
	runDirectWork: (params: Parameters<typeof runDirectWork>[0]) => mockRunDirectWork(params),
}));
// -------------------------
const mockBuildWorkOrderPlans = jest.fn<typeof buildWorkOrderPlans>();

jest.mock('#src/queue/workers/internal/buildWorkOrderPlans.ts', () => ({
	buildWorkOrderPlans: (params: Parameters<typeof buildWorkOrderPlans>[0]) => mockBuildWorkOrderPlans(params),
}));
// -------------------------
const mockRunAutoPlanWorker = jest.fn<typeof runAutoPlanWorker>();

jest.mock('#src/queue/workers/internal/runAutoPlanWorker.ts', () => ({
	runAutoPlanWorker: (params: Parameters<typeof runAutoPlanWorker>[0]) => mockRunAutoPlanWorker(params),
}));
// -------------------------
const mockPullWorkOrderState = jest.fn<typeof pullWorkOrderState>();

jest.mock('#src/workOrder/pullWorkOrderState.ts', () => ({
	pullWorkOrderState: (params: Parameters<typeof pullWorkOrderState>[0]) => mockPullWorkOrderState(params),
}));
// -------------------------
// The direct worker builds through the body-build lifecycle, which owns the
// record writes and has its own tests; this stand-in only hands the run an id.
const mockRunWorkOrderBodyBuildLifecycle = jest.fn<typeof runWorkOrderBodyBuildLifecycle>();

jest.mock('#src/workOrder/implementRun/runWorkOrderBodyBuildLifecycle.ts', () => ({
	runWorkOrderBodyBuildLifecycle: (params: Parameters<typeof runWorkOrderBodyBuildLifecycle>[0]) => mockRunWorkOrderBodyBuildLifecycle(params),
}));
// -------------------------

type Receiver = 'runDirectWork' | 'buildWorkOrderPlans' | 'runAutoPlanWorker';

const receivers = {
	runDirectWork: mockRunDirectWork,
	buildWorkOrderPlans: mockBuildWorkOrderPlans,
	runAutoPlanWorker: mockRunAutoPlanWorker,
};

/** The stamped config: the implement entry's harness written over the file's. */
const config: LightsoutConfig = { harness: 'claude-code', gates: { check: 'true', test: 'true', 'test-coverage': false } };

const driver: Driver = { name: 'claude-code', invoke: () => Promise.resolve({ text: '', exitCode: 0 }) };

/** No case here escalates, so nothing is ever asked. */
const relay: QuestionRelay = {
	ask: () => Promise.reject(new Error('no worker here asks a question')),
	createProgressSink: () => () => undefined,
	close: () => undefined,
};

const ticketRecord: WorkOrderState = {
	schemaVersion: 1,
	name: 'lo-70-drain',
	ticketRef: 'LO-70',
	branch: 'lo-70-drain',
	mode: 'multiple-plan',
	plans: [{ id: '002-drain-order', title: 'Drain order', progress: 'ready', createdAt: '2026-01-02T00:00:00.000Z' }],
	history: [{ at: '2026-01-02T00:00:00.000Z', kind: 'plan-added', detail: 'added plan 002-drain-order' }],
};

const setupWorker = ({ worker, record }: { worker: QueueWorker; record: WorkOrderState | undefined }) => {
	const loadedConfig: LoadedConfig = {
		config: { harness: 'codex', gates: { check: 'pnpm check', test: 'pnpm test', 'test-coverage': false } },
		path: '/repo/lightsout.config.json',
	};
	const coordinatorRunDir = mkdtempSync(join(tmpdir(), 'lightsout-loaded-config-worker-'));

	mockPullWorkOrderState.mockResolvedValue({ record });
	mockBuildWorkOrderPlans.mockResolvedValue({});
	mockRunAutoPlanWorker.mockResolvedValue({});
	mockRunWorkOrderBodyBuildLifecycle.mockImplementation(async ({ run }) => ({ result: await run({ runId: 'run-body-1' }) }));
	mockRunDirectWork.mockResolvedValue({
		ok: true,
		manifest: {
			runId: 'run-body-1',
			createdAt: '2026-01-01T00:00:00.000Z',
			updatedAt: '2026-01-01T00:00:01.000Z',
			plan: '.lightsout/runs/run-body-1/ticket.md',
			harness: 'claude-code',
			status: RunStatus.Passed,
			currentStep: null,
			steps: [],
			changedFiles: [],
			commits: [],
			packages: [],
			baselineDirtyFiles: [],
			testSubjects: [],
			acceptanceTests: [],
			approvedTests: [],
			unreachableChangedFiles: [],
			coverageExcludedChangedFiles: [],
		},
	});

	const ticket: RunnableTicket = {
		id: 'id-70',
		identifier: 'LO-70',
		title: 'Drain the backlog',
		url: 'https://linear.app/lightsout/issue/LO-70',
		description: 'Build the thing.',
		priority: 2,
		createdAt: '2026-01-01T00:00:00.000Z',
		labels: [],
		planningStatus: PlanningStatus.NotNeeded,
		worker,
		status: 'Ready to implement',
		finished: false,
		unfinishedBlockers: [],
	};

	return {
		loadedConfig,
		params: {
			worktreePath: mkdtempSync(join(tmpdir(), 'lightsout-loaded-config-worktree-')),
			workOrderName: 'lo-70-drain',
			settings: queueSettingsFixture(),
			ticket,
			config,
			loadedConfig,
			driver,
			driverName: 'claude-code',
			relay,
			coordinatorRunId: 'run-q',
			coordinatorRunDir,
			workOrderRunDir: join(coordinatorRunDir, 'work-orders', 'LO-70'),
			env: {},
		},
	};
};

const workerKinds: { worker: QueueWorker; record: WorkOrderState | undefined; receiver: Receiver }[] = [
	{ worker: QueueWorker.Direct, record: undefined, receiver: 'runDirectWork' },
	{ worker: QueueWorker.Plan, record: ticketRecord, receiver: 'buildWorkOrderPlans' },
	{ worker: QueueWorker.Plan, record: undefined, receiver: 'runDirectWork' },
	{ worker: QueueWorker.AutoPlan, record: undefined, receiver: 'runAutoPlanWorker' },
];

describe('runWorkerWithRelay', () => {
	test.each(workerKinds)("every worker kind receives the queue's loaded config", async ({ worker, record, receiver }) => {
		const { loadedConfig, params } = setupWorker({ worker, record });

		await runWorkerWithRelay(params);

		expect(receivers[receiver]).toHaveBeenCalledWith(
			expect.objectContaining({
				config,
				loadedConfig: {
					config: { harness: 'codex', gates: { check: 'pnpm check', test: 'pnpm test', 'test-coverage': false } },
					path: '/repo/lightsout.config.json',
				},
			}),
		);
		expect(receivers[receiver].mock.calls[0]?.[0].loadedConfig).toBe(loadedConfig);
	});
});
