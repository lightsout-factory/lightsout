import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PassThrough, Writable } from 'node:stream';
import { describe, expect, jest, test } from '@jest/globals';
import { PlanningStatus } from '#src/common/constants/PlanningStatus.ts';
import type { Driver } from '#src/common/types/Driver.ts';
import type { WorkOrderPlanOutcome } from '#src/common/types/WorkOrderPlanOutcome.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig/LightsoutConfig.ts';
import type { RunManifest } from '#src/contracts/run/RunManifest.ts';
import type { RunOwner } from '#src/contracts/run/RunOwner.ts';
import { RunStatus } from '#src/contracts/run/RunStatus.ts';
import type { WorkOrderState } from '#src/contracts/workOrder/WorkOrderState.ts';
import type { PipelineResult } from '#src/pipeline/PipelineResult.ts';
import { QueueWorker } from '#src/queue/common/constants/QueueWorker.ts';
import type { QuestionRelay } from '#src/queue/common/types/QuestionRelay.ts';
import type { RunnableTicket } from '#src/queue/internal/common/types/RunnableTicket.ts';
import type { WorkerOutcome } from '#src/queue/internal/common/types/WorkerOutcome.ts';
import { TerminalQuestionRelay } from '#src/queue/relay/TerminalQuestionRelay.ts';
import { runWorkerWithRelay } from '#src/queue/workers/runWorkerWithRelay.ts';
import { createRun } from '#src/runState/createRun.ts';
import { readRunOwner } from '#src/runState/owner/readRunOwner.ts';
import { queueSettingsFixture } from '#tests/helpers/queueSettingsFixture.ts';
import { setupConsumerRepo } from '#tests/helpers/setupConsumerRepo.ts';
import { trackerSettingsFixture } from '#tests/helpers/trackerSettingsFixture.ts';

// Mocked Imports
// -------------------------
// Every worker spawns a harness or a pipeline — another module's entry point,
// each covered by its own tests. What this file owns is which worker the ticket
// selects and the loop between a worker's question and the answer that comes
// back, which is observable with them stubbed.
const mockRunAutoPlanWorker = jest.fn<(params: { answeredQuestion?: { question: string; answer: string } }) => Promise<WorkerOutcome>>();
const mockRunDirectWork = jest.fn<(params: { answeredQuestion?: { question: string; answer: string } }) => Promise<PipelineResult>>();
const mockAppendTicketNote = jest.fn<() => Promise<undefined>>();

jest.mock('#src/queue/workers/internal/runAutoPlanWorker.ts', () => ({
	runAutoPlanWorker: (params: { answeredQuestion?: { question: string; answer: string } }) => mockRunAutoPlanWorker(params),
}));
jest.mock('#src/direct/runDirectWork/runDirectWork.ts', () => ({
	runDirectWork: (params: { answeredQuestion?: { question: string; answer: string } }) => mockRunDirectWork(params),
}));
jest.mock('#src/ticketTracker/appendTicketNote.ts', () => ({ appendTicketNote: () => mockAppendTicketNote() }));
// -------------------------
// Every ticket here carries no ticket record, so the pull is stubbed to answer
// nothing. What a record changes is stated in
// `runWorkerWithRelay.planWorker.unit.test.ts`.
interface PullTicketRecordParams {
	cwd: string;
	workOrderName: string;
	config: LightsoutConfig;
	env: NodeJS.ProcessEnv;
	onProgress?: (message: string) => void;
}

type PullTicketRecordResult = { record: WorkOrderState | undefined } | { error: string };

const mockPullTicketRecord = jest.fn<(params: PullTicketRecordParams) => Promise<PullTicketRecordResult>>();

// The direct worker builds through the body-build lifecycle, which owns the
// record writes and is covered by its own tests. By default it hands the run a
// fixed id and answers the run's result, so every case written before it keeps
// its meaning; the cases that state the lifecycle's part arm it themselves.
interface BodyBuildLifecycleParams {
	cwd: string;
	workOrderName: string;
	run: (params: { runId: string }) => Promise<PipelineResult>;
}

const mockRunWorkOrderBodyBuildLifecycle = jest.fn<(params: BodyBuildLifecycleParams) => Promise<WorkOrderPlanOutcome>>(async ({ run }) => ({
	result: await run({ runId: 'run-body-1' }),
}));

jest.mock('#src/workOrder/implementRun/runWorkOrderBodyBuildLifecycle.ts', () => ({
	runWorkOrderBodyBuildLifecycle: (params: BodyBuildLifecycleParams) => mockRunWorkOrderBodyBuildLifecycle(params),
}));
jest.mock('#src/workOrder/pullWorkOrderState.ts', () => ({ pullWorkOrderState: (params: PullTicketRecordParams) => mockPullTicketRecord(params) }));
// -------------------------

const settings = queueSettingsFixture();

const config: LightsoutConfig = { gates: { check: 'true', test: 'true', 'test-coverage': false } };
const driver: Driver = { name: 'claude-code', invoke: () => Promise.resolve({ text: '', exitCode: 0 }) };

const ticketOf = (worker: QueueWorker): RunnableTicket => ({
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
});

const manifestOf = (status: RunStatus): RunManifest => ({
	runId: 'run-1',
	createdAt: '2026-01-01T00:00:00.000Z',
	updatedAt: '2026-01-01T00:00:01.000Z',
	plan: '.lightsout/runs/run-1/ticket.md',
	harness: 'claude-code',
	status,
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
});

/** Lifecycle answers that leave a direct build unrecorded: a refusal before the run, and a record write that failed after a passed run. */
const unrecordedBodyBuilds: { answer: (params: BodyBuildLifecycleParams) => Promise<WorkOrderPlanOutcome>; stated: string; directRuns: number }[] = [
	{
		answer: () => Promise.resolve({ refusal: 'work order lo-70-drain now holds plan 001, so its build from the ticket body is not recorded' }),
		stated: 'work order lo-70-drain now holds plan 001, so its build from the ticket body is not recorded',
		directRuns: 0,
	},
	{
		answer: async ({ run }) => ({ result: await run({ runId: 'run-body-1' }), recordError: 'the record of lo-70-drain could not be written: ENOENT' }),
		stated: 'the record of lo-70-drain could not be written: ENOENT',
		directRuns: 1,
	},
];

/** A relay on a pair of streams, typing each queued answer as its prompt appears. */
const setupRelay = ({ answers = [] }: { answers?: string[] } = {}) => {
	const input = new PassThrough();
	const queued = [...answers];
	const output = new Writable({
		write(chunk: Buffer, _encoding, done) {
			if (chunk.toString().includes('answer: ')) {
				const next = queued.shift();

				if (next !== undefined) {
					setImmediate(() => input.write(`${next}\n`));
				} else {
					setImmediate(() => input.end());
				}
			}

			done();
		},
	});

	mockAppendTicketNote.mockResolvedValue(undefined);
	// The ordinary ticket here carries no record, which is the legacy shape every
	// case below this one was written against.
	mockPullTicketRecord.mockResolvedValue({ record: undefined });

	return {
		relay: new TerminalQuestionRelay({ settings, trackerSettings: trackerSettingsFixture(), input, output }),
		coordinatorRunDir: mkdtempSync(join(tmpdir(), 'lightsout-worker-')),
	};
};

const runWorker = ({
	relay,
	coordinatorRunDir,
	ticket,
	worktreePath = '/tmp/lo-70-drain',
}: {
	relay: QuestionRelay;
	coordinatorRunDir: string;
	ticket: RunnableTicket;
	worktreePath?: string;
}) =>
	runWorkerWithRelay({
		worktreePath,
		workOrderName: 'lo-70-drain',
		ticket,
		config,
		loadedConfig: { config },
		driver,
		driverName: 'claude-code',
		settings,
		relay,
		coordinatorRunId: 'run-q',
		coordinatorRunDir,
		workOrderRunDir: join(coordinatorRunDir, 'work-orders', ticket.identifier),
		env: {},
	});

/** What a direct worker's build is handed beyond its answer: the worktree, the run id the lifecycle minted, and the queue run its owner record points at. */
interface OwnedDirectWorkParams {
	cwd: string;
	runId: string;
	queueRunId?: string;
	answeredQuestion?: { question: string; answer: string };
}

/**
 * A direct worker in a real worktree whose stubbed build stands in for
 * `runDirectWork` creating its run — handing `createRun` whatever queue run id
 * the worker passed down — and notes the run's owner record as the build sees it.
 */
const setupOwnedDirectRun = () => {
	const { relay, coordinatorRunDir } = setupRelay();
	const worktreePath = setupConsumerRepo({ git: false });
	const seen: { ownerWhileRunning?: RunOwner } = {};

	mockRunDirectWork.mockImplementationOnce(async (params) => {
		const { cwd, runId, queueRunId } = params as OwnedDirectWorkParams;

		await createRun({ cwd, runId, plan: 'plan.md', driver: 'stub', queueRunId });
		seen.ownerWhileRunning = await readRunOwner({ cwd, runId });

		return { ok: true, manifest: manifestOf(RunStatus.Passed) };
	});

	return { relay, coordinatorRunDir, worktreePath, seen };
};

describe('runWorkerWithRelay', () => {
	test('a direct worker that finishes needs no question, and the relay is never used', async () => {
		const { relay, coordinatorRunDir } = setupRelay();

		mockRunDirectWork.mockResolvedValue({ ok: true, manifest: manifestOf(RunStatus.Passed) });

		expect(await runWorker({ relay, coordinatorRunDir, ticket: ticketOf(QueueWorker.Direct) })).toStrictEqual({});

		relay.close();
	});

	test('relays a direct worker’s escalation and re-invokes it with the answer, in the same tree', async () => {
		const { relay, coordinatorRunDir } = setupRelay({ answers: ['the second one'] });

		mockRunDirectWork
			.mockResolvedValueOnce({ ok: false, manifest: manifestOf(RunStatus.Escalated), error: 'Which one?' })
			.mockResolvedValueOnce({ ok: true, manifest: manifestOf(RunStatus.Passed) });

		const outcome = await runWorker({ relay, coordinatorRunDir, ticket: ticketOf(QueueWorker.Direct) });

		relay.close();

		expect(outcome).toStrictEqual({});
		expect(mockRunDirectWork).toHaveBeenLastCalledWith(expect.objectContaining({ answeredQuestion: { question: 'Which one?', answer: 'the second one' } }));
	});

	test('parks a direct run that failed for any other reason, carrying the worker’s own error', async () => {
		const { relay, coordinatorRunDir } = setupRelay();

		mockRunDirectWork.mockResolvedValue({ ok: false, manifest: manifestOf(RunStatus.Failed), error: 'tsc: 3 errors' });

		expect(await runWorker({ relay, coordinatorRunDir, ticket: ticketOf(QueueWorker.Direct) })).toStrictEqual({ error: 'tsc: 3 errors' });

		relay.close();
	});

	test('names the state a run ended in when it stopped without saying why', async () => {
		const { relay, coordinatorRunDir } = setupRelay();

		mockRunDirectWork.mockResolvedValue({ ok: false, manifest: manifestOf(RunStatus.PausedRateLimit) });

		expect(await runWorker({ relay, coordinatorRunDir, ticket: ticketOf(QueueWorker.Direct) })).toStrictEqual({ error: 'the run ended paused-rate-limit' });

		relay.close();
	});

	test('an auto-plan worker that reports complete needs no question either', async () => {
		const { relay, coordinatorRunDir } = setupRelay();

		mockRunAutoPlanWorker.mockResolvedValue({});

		expect(await runWorker({ relay, coordinatorRunDir, ticket: ticketOf(QueueWorker.AutoPlan) })).toStrictEqual({});

		relay.close();
	});

	test('relays an auto-plan worker’s first failure as the question it asked, and folds the answer into the next invocation', async () => {
		const { relay, coordinatorRunDir } = setupRelay({ answers: ['the second one'] });

		mockRunAutoPlanWorker.mockResolvedValueOnce({ question: 'Which one?' }).mockResolvedValueOnce({});

		const outcome = await runWorker({ relay, coordinatorRunDir, ticket: ticketOf(QueueWorker.AutoPlan) });

		relay.close();

		expect(outcome).toStrictEqual({});
		expect(mockRunAutoPlanWorker).toHaveBeenLastCalledWith(expect.objectContaining({ answeredQuestion: { question: 'Which one?', answer: 'the second one' } }));
	});

	test('stops relaying once the answers have run out, rather than asking the user forever', async () => {
		const { relay, coordinatorRunDir } = setupRelay({ answers: ['first', 'second', 'third', 'fourth'] });

		mockRunDirectWork.mockResolvedValue({ ok: false, manifest: manifestOf(RunStatus.Escalated), error: 'Which one?' });

		const outcome = await runWorker({ relay, coordinatorRunDir, ticket: ticketOf(QueueWorker.Direct) });

		relay.close();

		expect(outcome).toEqual({ error: expect.stringContaining('still asking after') });
		expect(mockRunDirectWork).toHaveBeenCalledTimes(3);
	});

	test('parks the ticket when there is no terminal to relay to, and marks the park unanswered — that is the one that retires a drain slot', async () => {
		const { relay, coordinatorRunDir } = setupRelay();

		mockRunDirectWork.mockResolvedValue({ ok: false, manifest: manifestOf(RunStatus.Escalated), error: 'Which one?' });

		const outcome = await runWorker({ relay, coordinatorRunDir, ticket: ticketOf(QueueWorker.Direct) });

		relay.close();

		expect(outcome).toEqual({ error: expect.stringContaining('could not be relayed'), unanswered: true });
	});

	test('the direct worker builds through the body-build lifecycle under the run id it is handed', async () => {
		const { relay, coordinatorRunDir } = setupRelay();

		mockRunDirectWork.mockResolvedValue({ ok: true, manifest: manifestOf(RunStatus.Passed) });
		mockRunWorkOrderBodyBuildLifecycle.mockImplementationOnce(async ({ run }) => ({ result: await run({ runId: 'run-handed' }) }));

		const outcome = await runWorker({ relay, coordinatorRunDir, ticket: ticketOf(QueueWorker.Direct) });

		relay.close();

		expect(outcome).toStrictEqual({});
		expect(mockRunWorkOrderBodyBuildLifecycle).toHaveBeenCalledWith(expect.objectContaining({ cwd: '/tmp/lo-70-drain', workOrderName: 'lo-70-drain' }));
		expect(mockRunDirectWork).toHaveBeenCalledWith(expect.objectContaining({ runId: 'run-handed' }));
	});

	test('parks a failed direct build with the run’s own error even when its record write failed too', async () => {
		const { relay, coordinatorRunDir } = setupRelay();

		mockRunDirectWork.mockResolvedValue({ ok: false, manifest: manifestOf(RunStatus.Failed), error: 'tsc: 3 errors' });
		mockRunWorkOrderBodyBuildLifecycle.mockImplementationOnce(async ({ run }) => ({
			result: await run({ runId: 'run-body-1' }),
			recordError: 'the record of lo-70-drain could not be written: ENOENT',
		}));

		const outcome = await runWorker({ relay, coordinatorRunDir, ticket: ticketOf(QueueWorker.Direct) });

		relay.close();

		expect(outcome).toStrictEqual({ error: 'tsc: 3 errors' });
	});

	test.each(unrecordedBodyBuilds)(
		'parks a direct worker whose body-build lifecycle refused or could not record its passed build',
		async ({ answer, stated, directRuns }) => {
			const { relay, coordinatorRunDir } = setupRelay();

			mockRunDirectWork.mockResolvedValue({ ok: true, manifest: manifestOf(RunStatus.Passed) });
			mockRunWorkOrderBodyBuildLifecycle.mockImplementationOnce(answer);

			const outcome = await runWorker({ relay, coordinatorRunDir, ticket: ticketOf(QueueWorker.Direct) });

			relay.close();

			expect(outcome).toStrictEqual({ error: stated });
			expect(mockRunDirectWork).toHaveBeenCalledTimes(directRuns);
		},
	);

	test("points a direct worker's run at the coordinator run until its build settles", async () => {
		const { relay, coordinatorRunDir, worktreePath, seen } = setupOwnedDirectRun();

		const outcome = await runWorkerWithRelay({
			worktreePath,
			workOrderName: 'lo-70-drain',
			ticket: ticketOf(QueueWorker.Direct),
			config,
			loadedConfig: { config },
			driver,
			driverName: 'claude-code',
			settings,
			relay,
			coordinatorRunId: 'q-1',
			coordinatorRunDir,
			workOrderRunDir: join(coordinatorRunDir, 'work-orders', 'LO-70'),
			env: {},
		});
		const ownerAfter = await readRunOwner({ cwd: worktreePath, runId: 'run-body-1' });

		relay.close();

		expect({ outcome, ownerWhileRunning: seen.ownerWhileRunning, ownerAfter }).toStrictEqual({
			outcome: {},
			ownerWhileRunning: { queueRunId: 'q-1' },
			ownerAfter: undefined,
		});
	});
});
