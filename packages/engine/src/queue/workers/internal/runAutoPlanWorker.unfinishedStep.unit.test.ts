import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, jest, test } from '@jest/globals';
import { PlanningStatus } from '#src/common/constants/PlanningStatus.ts';
import type { AgentOutcome } from '#src/common/types/AgentOutcome.ts';
import type { Driver } from '#src/common/types/Driver.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig/LightsoutConfig.ts';
import type { PlanningProgress } from '#src/contracts/plan/progress/PlanningProgress.ts';
import { PlanningStep } from '#src/contracts/plan/progress/PlanningStep.ts';
import type { PlanningStepRecord } from '#src/contracts/plan/progress/PlanningStepRecord.ts';
import { RunStatus } from '#src/contracts/run/RunStatus.ts';
import type { WorkReport } from '#src/contracts/work/WorkReport.ts';
import { WorkReportStatus } from '#src/contracts/work/WorkReportStatus.ts';
import type { WorkOrderState } from '#src/contracts/workOrder/WorkOrderState.ts';
import type { TicketSummary } from '#src/queue/common/types/TicketSummary.ts';
import type { WorkerOutcome } from '#src/queue/internal/common/types/WorkerOutcome.ts';
import { runAutoPlanWorker } from '#src/queue/workers/internal/runAutoPlanWorker.ts';
import { planWorkspaceFolder } from '#tests/helpers/planWorkspaceFolder.ts';
import { queueSettingsFixture } from '#tests/helpers/queueSettingsFixture.ts';

/**
 * What the worker does with a planning session that ended while an engine
 * command it started was still running: the harness kills whatever is left
 * when the turn ends, so the plan's planning-progress record still holds that
 * step `running`, and the worker parks the ticket whatever the session
 * reported.
 *
 * The harness is mocked so each case can write the record the session's
 * commands would have left, at the moment the session runs.
 */

// Mocked Imports
// -------------------------
/** The fields of the harness invocation these cases read; the real call carries more. */
interface InvokeCall {
	foregroundCommandsOnly?: boolean;
}

const mockInvokeAgentWithContract = jest.fn<(params: InvokeCall) => Promise<AgentOutcome<WorkReport>>>();

jest.mock('#src/invoke/invokeAgentWithContract/invokeAgentWithContract.ts', () => ({
	invokeAgentWithContract: (params: InvokeCall) => mockInvokeAgentWithContract(params),
}));
// -------------------------
// The engine's choice of plan and the ordered build around the session are each
// covered by their own tests; stubbing them leaves the session and its planning
// record as the only things the worker judges.
const mockChooseAutoPlanTarget = jest.fn<() => Promise<{ record: WorkOrderState; address?: string } | { error: string }>>();

jest.mock('#src/queue/workers/internal/chooseAutoPlanTarget.ts', () => ({ chooseAutoPlanTarget: () => mockChooseAutoPlanTarget() }));
// -------------------------
const mockBuildWorkOrderPlans = jest.fn<() => Promise<WorkerOutcome>>();

jest.mock('#src/queue/workers/internal/buildWorkOrderPlans.ts', () => ({ buildWorkOrderPlans: () => mockBuildWorkOrderPlans() }));
// -------------------------
const mockPullWorkOrderState = jest.fn<() => Promise<{ record: WorkOrderState | undefined } | { error: string }>>();

jest.mock('#src/workOrder/pullWorkOrderState.ts', () => ({ pullWorkOrderState: () => mockPullWorkOrderState() }));
// -------------------------

const branch = 'lo-196-keep-drafts';
const planId = '001-finish-every-command';
const address = `${branch}/${planId}`;

/** A pid no process holds, so its step reads as a command that has since died. */
const deadPid = 999_999_999;

const driver: Driver = { name: 'claude-code', invoke: () => Promise.resolve({ text: '', exitCode: 0 }) };

const ticket: TicketSummary = {
	id: 'id-196',
	identifier: 'LO-196',
	title: 'Finish every engine command',
	url: 'https://linear.app/lightsout/issue/LO-196',
	description: 'Keep plan draft inside the turn.',
	priority: 2,
	createdAt: '2026-01-01T00:00:00.000Z',
	labels: [],
	planningStatus: PlanningStatus.ReadyAutoPlan,
	status: 'Ready to implement',
	finished: false,
	unfinishedBlockers: [],
};

/** The work order's record, holding the one plan the engine handed the session. */
const record: WorkOrderState = {
	schemaVersion: 1,
	name: branch,
	ticketRef: 'LO-196',
	branch,
	mode: 'multiple-plan',
	plans: [{ id: planId, title: 'Finish every engine command', progress: 'planning', createdAt: '2026-01-01T00:00:00.000Z' }],
	history: [],
};

const config: LightsoutConfig = { gates: { check: 'true', test: 'true', 'test-coverage': false } };

const reportOf = (overrides: Partial<WorkReport> = {}): WorkReport => ({
	status: WorkReportStatus.Complete,
	changedFiles: [],
	summary: 'planned it',
	failures: [],
	...overrides,
});

/** A step the session's own command recorded, stamped when the session runs — so after it began. */
interface SessionStep {
	step: PlanningStep;
	status: RunStatus;
	pid: number;
}

const writeRecord = ({ folder, steps }: { folder: string; steps: PlanningStepRecord[] }) => {
	const progress: PlanningProgress = { name: address, updatedAt: new Date().toISOString(), steps };

	writeFileSync(join(folder, 'planning-progress.json'), JSON.stringify(progress), 'utf8');
};

const sessionEntryOf = ({ step, status, pid }: SessionStep): PlanningStepRecord => {
	const startedAt = new Date().toISOString();

	return status === RunStatus.Running
		? { step, status, attempts: 1, pid, startedAt }
		: { step, status, attempts: 1, pid, startedAt, finishedAt: startedAt, durationMs: 0 };
};

/**
 * The worker's arguments against a real worktree holding the chosen plan's
 * folder, with the planning record its commands leave behind.
 *
 * `earlierSteps` are on disk before the session starts — an earlier
 * invocation's. `sessionSteps` are written while the harness call runs, as the
 * session's own commands would write them. `outcome` is what the harness then
 * hands back.
 */
const setupUnfinishedStep = ({
	outcome = { ok: true, report: reportOf() },
	earlierSteps = [],
	sessionSteps = [],
	built = {},
}: {
	outcome?: AgentOutcome<WorkReport>;
	earlierSteps?: PlanningStepRecord[];
	sessionSteps?: SessionStep[];
	built?: WorkerOutcome;
} = {}) => {
	const cwd = mkdtempSync(join(tmpdir(), 'lightsout-auto-plan-unfinished-'));
	const folder = planWorkspaceFolder({ cwd, name: address });

	mkdirSync(folder, { recursive: true });
	writeFileSync(join(folder, 'plan.md'), '# The plan\n');

	if (earlierSteps.length > 0) {
		writeRecord({ folder, steps: earlierSteps });
	}

	mockChooseAutoPlanTarget.mockResolvedValue({ record, address });
	mockInvokeAgentWithContract.mockImplementation(() => {
		if (sessionSteps.length > 0) {
			const sessionStepNames = new Set(sessionSteps.map(({ step }) => step));
			const kept = earlierSteps.filter(({ step }) => !sessionStepNames.has(step));

			writeRecord({ folder, steps: [...kept, ...sessionSteps.map(sessionEntryOf)] });
		}

		return Promise.resolve(outcome);
	});
	mockPullWorkOrderState.mockResolvedValue({ record });
	mockBuildWorkOrderPlans.mockResolvedValue(built);

	return {
		params: {
			cwd,
			ticket,
			workOrderName: branch,
			config,
			loadedConfig: { config },
			driver,
			driverName: 'claude-code',
			settings: queueSettingsFixture(),
			env: {},
			workOrderRunDir: join(cwd, '.lightsout', 'runs', 'run-q', 'work-orders', 'LO-196'),
			queueRunId: 'run-q',
		},
	};
};

describe('runAutoPlanWorker', () => {
	test('runAutoPlanWorker: asks the harness to keep every command the planning session starts inside its turn', async () => {
		const { params } = setupUnfinishedStep();

		await runAutoPlanWorker(params);

		expect(mockInvokeAgentWithContract.mock.calls[0]?.[0].foregroundCommandsOnly).toBe(true);
	});

	test('runAutoPlanWorker: parks a session that reported complete while a step it started is still recorded running', async () => {
		const { params } = setupUnfinishedStep({
			sessionSteps: [
				{ step: PlanningStep.VerifyFacts, status: RunStatus.Passed, pid: deadPid },
				{ step: PlanningStep.Draft, status: RunStatus.Running, pid: deadPid },
			],
		});

		const workerOutcome = await runAutoPlanWorker(params);

		expect(workerOutcome).toEqual({ error: expect.stringContaining('draft') });
		expect(workerOutcome.error).toContain('LO-196');
		// the step's process has since died, so the reason never claims it is alive
		expect(workerOutcome.error).not.toContain(String(deadPid));
		expect(mockBuildWorkOrderPlans).not.toHaveBeenCalled();
	});

	test('runAutoPlanWorker: parks rather than relays a question asked while a step the session started is still recorded running', async () => {
		const { params } = setupUnfinishedStep({
			outcome: {
				ok: true,
				report: reportOf({ status: WorkReportStatus.TerminatedAmbiguity, failures: ['Should the draft cover the Codex driver too?'] }),
			},
			sessionSteps: [{ step: PlanningStep.Draft, status: RunStatus.Running, pid: deadPid }],
		});

		const workerOutcome = await runAutoPlanWorker(params);

		expect({ outcome: workerOutcome, carriesQuestion: Object.hasOwn(workerOutcome, 'question') }).toEqual({
			outcome: { error: expect.stringContaining('draft') },
			carriesQuestion: false,
		});
	});

	test('runAutoPlanWorker: names the pid of a step the session left running that is still alive', async () => {
		const { params } = setupUnfinishedStep({
			sessionSteps: [{ step: PlanningStep.Draft, status: RunStatus.Running, pid: process.pid }],
		});

		const workerOutcome = await runAutoPlanWorker(params);

		expect(workerOutcome).toEqual({ error: expect.stringContaining('draft') });
		expect(workerOutcome.error).toMatch(new RegExp(`\\b${process.pid}\\b`));
	});

	test('runAutoPlanWorker: names the unfinished step when the harness itself refused', async () => {
		const { params } = setupUnfinishedStep({
			outcome: { ok: false, failure: 'harness exited with code 143', rateLimited: false },
			sessionSteps: [{ step: PlanningStep.Grade, status: RunStatus.Running, pid: deadPid }],
		});

		const workerOutcome = await runAutoPlanWorker(params);

		expect(workerOutcome).toEqual({ error: expect.stringContaining('grade') });
	});

	test('runAutoPlanWorker: ignores a running record an earlier session started', async () => {
		const { params } = setupUnfinishedStep({
			earlierSteps: [
				{
					step: PlanningStep.VerifyFacts,
					status: RunStatus.Passed,
					attempts: 1,
					pid: deadPid,
					startedAt: '2026-01-01T09:00:00.000Z',
					finishedAt: '2026-01-01T09:00:30.000Z',
					durationMs: 30_000,
				},
				{ step: PlanningStep.Draft, status: RunStatus.Running, attempts: 1, pid: deadPid, startedAt: '2026-01-01T09:01:00.000Z' },
			],
			sessionSteps: [
				{ step: PlanningStep.Dedup, status: RunStatus.Passed, pid: deadPid },
				{ step: PlanningStep.Grade, status: RunStatus.Passed, pid: deadPid },
				{ step: PlanningStep.Publish, status: RunStatus.Passed, pid: deadPid },
			],
			built: { open: 'the work order does not authorize shipping yet' },
		});

		const workerOutcome = await runAutoPlanWorker(params);

		expect(workerOutcome).toStrictEqual({ open: 'the work order does not authorize shipping yet' });
		expect(mockBuildWorkOrderPlans).toHaveBeenCalledTimes(1);
	});
});
