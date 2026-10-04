import { describe, expect, jest, test } from '@jest/globals';
import { PlanningStatus } from '#src/common/constants/PlanningStatus.ts';
import type { Driver } from '#src/common/types/Driver.ts';
import type { LoadedConfig } from '#src/common/types/LoadedConfig.ts';
import type { TicketSummary } from '#src/common/types/TicketSummary.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig/LightsoutConfig.ts';
import type { WorkOrderState } from '#src/contracts/workOrder/WorkOrderState.ts';
import type { WorkerOutcome } from '#src/queue/common/types/WorkerOutcome.ts';
import { runAutoPlanWorker } from '#src/queue/workers/runWorkerWithRelay/runAutoPlanWorker/runAutoPlanWorker.ts';
import { queueSettingsFixture } from '#tests/helpers/queueSettingsFixture.ts';

/**
 * Which config the builds of an auto-planned work order record. The worker is
 * handed the queue's startup config as read beside the stamped one, and every
 * run its build creates must record the former, so one queue run keeps one
 * config for every ticket.
 */

// Mocked Imports
// -------------------------
// The choice reads the ticket record and the build loop runs pipelines — each
// covered by its own tests. A choice with nothing left to plan sends the worker
// straight to the build, so no planning session is spawned.
interface ChooseAutoPlanTargetParams {
	cwd: string;
	workOrderName: string;
	ticket: TicketSummary;
	config: LightsoutConfig;
	env: NodeJS.ProcessEnv;
	onProgress?: (message: string) => void;
}

type ChooseAutoPlanTargetResult = { record: WorkOrderState; address?: string } | { error: string };

const mockChooseAutoPlanTarget = jest.fn<(params: ChooseAutoPlanTargetParams) => Promise<ChooseAutoPlanTargetResult>>();

jest.mock('#src/queue/workers/runWorkerWithRelay/runAutoPlanWorker/chooseAutoPlanTarget.ts', () => ({
	chooseAutoPlanTarget: (params: ChooseAutoPlanTargetParams) => mockChooseAutoPlanTarget(params),
}));
// -------------------------
interface BuildWorkOrderPlansParams {
	cwd: string;
	workOrderName: string;
	record: WorkOrderState;
	config: LightsoutConfig;
	loadedConfig: LoadedConfig;
	env: NodeJS.ProcessEnv;
	driverName: string;
	workOrderRunDir: string;
	allowTicketBodyBuild: boolean;
}

const mockBuildWorkOrderPlans = jest.fn<(params: BuildWorkOrderPlansParams) => Promise<WorkerOutcome>>();

jest.mock('#src/queue/workers/runWorkerWithRelay/common/buildWorkOrderPlans/buildWorkOrderPlans.ts', () => ({
	buildWorkOrderPlans: (params: BuildWorkOrderPlansParams) => mockBuildWorkOrderPlans(params),
}));
// -------------------------

const workOrderName = 'lo-70-drain';
const cwd = '/repo/worktrees/lo-70-drain';

const driver: Driver = { name: 'claude-code', invoke: () => Promise.resolve({ text: '', exitCode: 0 }) };

const ticket: TicketSummary = {
	id: 'id-70',
	identifier: 'LO-70',
	title: 'Drain the backlog',
	url: 'https://linear.app/lightsout/issue/LO-70',
	description: 'Build the thing.',
	priority: 2,
	createdAt: '2026-01-01T00:00:00.000Z',
	labels: [],
	planningStatus: PlanningStatus.ReadyAutoPlan,
	status: 'Ready to implement',
	finished: false,
	unfinishedBlockers: [],
};

/** Every plan already ready, so the choice names no plan to hand a session. */
const readyRecord: WorkOrderState = {
	schemaVersion: 1,
	name: workOrderName,
	ticketRef: 'LO-70',
	branch: workOrderName,
	mode: 'multiple-plan',
	plans: [{ id: '001-drain-basics', title: 'Drain basics', progress: 'ready', createdAt: '2026-01-01T00:00:00.000Z' }],
	history: [],
};

/**
 * The worker's arguments, with a stamped config whose harness, model and effort
 * differ from the config as read, so a build handed the stamped one in place
 * of the loaded one is told apart.
 */
const setupAutoPlanWorker = () => {
	mockChooseAutoPlanTarget.mockResolvedValue({ record: readyRecord });
	mockBuildWorkOrderPlans.mockResolvedValue({});

	const loadedConfig: LoadedConfig = {
		config: { harness: 'codex', gates: { check: 'pnpm check', test: 'pnpm test', 'test-coverage': false } },
		path: '/repo/lightsout.config.json',
	};
	const config: LightsoutConfig = {
		harness: 'claude-code',
		model: 'opus',
		effort: 'high',
		gates: { check: 'pnpm check', test: 'pnpm test', 'test-coverage': false },
	};

	return {
		params: {
			cwd,
			ticket,
			workOrderName,
			config,
			loadedConfig,
			driver,
			driverName: 'claude-code',
			settings: queueSettingsFixture(),
			env: {},
			workOrderRunDir: `${cwd}/.lightsout/runs/run-q/work-orders/LO-70`,
			queueRunId: 'run-q',
		},
	};
};

describe('runAutoPlanWorker', () => {
	test("the auto-plan worker builds with the queue's loaded config", async () => {
		const { params } = setupAutoPlanWorker();

		await runAutoPlanWorker(params);

		expect(mockBuildWorkOrderPlans.mock.calls.map(([call]) => call.loadedConfig)).toStrictEqual([
			{
				config: { harness: 'codex', gates: { check: 'pnpm check', test: 'pnpm test', 'test-coverage': false } },
				path: '/repo/lightsout.config.json',
			},
		]);
	});
});
