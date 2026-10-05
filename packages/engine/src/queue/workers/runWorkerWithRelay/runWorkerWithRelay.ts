import { QueueWorker } from '#src/common/constants/QueueWorker.ts';
import { messageOf } from '#src/common/messageOf.ts';
import type { AnsweredQuestion } from '#src/common/types/AnsweredQuestion.ts';
import type { Driver } from '#src/common/types/Driver.ts';
import type { LoadedConfig } from '#src/common/types/LoadedConfig.ts';
import type { QuestionRelay } from '#src/common/types/QuestionRelay.ts';
import type { QueueSettings } from '#src/common/types/QueueSettings.ts';
import type { TicketSummary } from '#src/common/types/TicketSummary.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig/LightsoutConfig.ts';
import { RunStatus } from '#src/contracts/run/RunStatus.ts';
import { runDirectWork } from '#src/direct/runDirectWork/runDirectWork.ts';
import type { RunnableTicket } from '#src/queue/common/types/RunnableTicket.ts';
import type { WorkerOutcome } from '#src/queue/common/types/WorkerOutcome.ts';
import { toWorkerOutcome } from '#src/queue/workers/common/toWorkerOutcome.ts';
import { buildWorkOrderPlans } from '#src/queue/workers/runWorkerWithRelay/common/buildWorkOrderPlans/buildWorkOrderPlans.ts';
import { runAutoPlanWorker } from '#src/queue/workers/runWorkerWithRelay/runAutoPlanWorker/runAutoPlanWorker.ts';
import { removeRunOwner } from '#src/runState/owner/removeRunOwner.ts';
import { runWorkOrderBodyBuildLifecycle } from '#src/workOrder/implementRun/runWorkOrderBodyBuildLifecycle.ts';
import { pullWorkOrderState } from '#src/workOrder/pullWorkOrderState.ts';

interface Params {
	/** The worktree this ticket is built in. */
	worktreePath: string;
	/** The work order's label — the folder its record and its plans live under, and the first segment of every plan address it holds. */
	workOrderName: string;
	settings: QueueSettings;
	ticket: RunnableTicket;
	config: LightsoutConfig;
	/** The queue's startup config as it was read from disk, and its path, which every run this worker creates records. */
	loadedConfig: LoadedConfig;
	driver: Driver;
	driverName: string;
	relay: QuestionRelay;
	/** The coordinator run's id, stamped on every relayed question and answer. */
	coordinatorRunId: string;
	/** The coordinator run's directory in the main checkout, where the relay records them. */
	coordinatorRunDir: string;
	/** The ticket's own directory under the coordinator run, where every commit message file this ticket needs is written. */
	workOrderRunDir: string;
	/** The process environment the tracker credentials are read from. Passed rather than read, so a test never needs to mutate `process.env`. */
	env: NodeJS.ProcessEnv;
	onProgress?: (message: string) => void;
}

const runDirectWorker = async ({
	cwd,
	workOrderName,
	ticket,
	config,
	loadedConfig,
	driver,
	driverName,
	answeredQuestion,
	onProgress,
	queueRunId,
}: {
	cwd: string;
	workOrderName: string;
	ticket: TicketSummary;
	config: LightsoutConfig;
	loadedConfig: LoadedConfig;
	driver: Driver;
	driverName: string;
	answeredQuestion?: AnsweredQuestion;
	onProgress?: (message: string) => void;
	queueRunId: string;
}): Promise<WorkerOutcome> => {
	const outcome = await runWorkOrderBodyBuildLifecycle({
		cwd,
		workOrderName,
		run: async ({ runId }) => {
			// A settled worker run must stop pointing at the queue, which keeps running.
			try {
				return await runDirectWork({
					cwd,
					ticketBody: ticket.description,
					ticketRef: ticket.identifier,
					runId,
					driver,
					driverName,
					config,
					loadedConfig,
					answeredQuestion,
					onProgress,
					queueRunId,
				});
			} finally {
				await removeRunOwner({ cwd, runId });
			}
		},
	});

	return toWorkerOutcome({
		outcome,
		onFailedRun: ({ stated, result }) => (result.manifest.status === RunStatus.Escalated ? { question: stated } : { error: stated }),
	});
};

/**
 * A ticket with no record is not an error: shaping may have finished on
 * approved brainstorm material, whose outcome lives in the ticket body.
 */
const runPlanWorker = async ({
	cwd,
	ticket,
	workOrderName,
	config,
	loadedConfig,
	driver,
	driverName,
	env,
	workOrderRunDir,
	onProgress,
	queueRunId,
}: {
	cwd: string;
	ticket: TicketSummary;
	workOrderName: string;
	config: LightsoutConfig;
	loadedConfig: LoadedConfig;
	driver: Driver;
	driverName: string;
	env: NodeJS.ProcessEnv;
	workOrderRunDir: string;
	onProgress?: (message: string) => void;
	queueRunId: string;
}): Promise<WorkerOutcome> => {
	const pulled = await pullWorkOrderState({ cwd, name: workOrderName, config, env, onProgress });

	if ('error' in pulled) {
		return { error: pulled.error };
	}

	if (pulled.record !== undefined) {
		return buildWorkOrderPlans({
			cwd,
			workOrderName,
			ticket,
			record: pulled.record,
			config,
			loadedConfig,
			env,
			driver,
			driverName,
			workOrderRunDir,
			allowTicketBodyBuild: true,
			onProgress,
			queueRunId,
		});
	}

	onProgress?.(`${ticket.identifier} carries no published plan, so it is built from the ticket body`);

	return runDirectWorker({ cwd, workOrderName, ticket, config, loadedConfig, driver, driverName, onProgress, queueRunId });
};

/**
 * A worker still asking after the last turn parks, and so does a relay with no
 * terminal behind it — one ticket that cannot be answered must never take the
 * other in-flight workers down with it.
 */
export const runWorkerWithRelay = async ({
	worktreePath,
	workOrderName,
	ticket,
	config,
	loadedConfig,
	driver,
	driverName,
	settings,
	relay,
	coordinatorRunId,
	coordinatorRunDir,
	workOrderRunDir,
	env,
	onProgress,
}: Params): Promise<WorkerOutcome> => {
	// Deliberately its own number rather than the gate-fix retry count it happens
	// to equal: tuning gate retries must never change how often the user is asked.
	const maxRelayedQuestions = 2;
	const workerInputs = { cwd: worktreePath, workOrderName, ticket, config, loadedConfig, driver, driverName, onProgress, queueRunId: coordinatorRunId };
	let answeredQuestion: AnsweredQuestion | undefined;

	for (let turn = 0; ; turn += 1) {
		const workers: Record<QueueWorker, () => Promise<WorkerOutcome>> = {
			[QueueWorker.Direct]: () => runDirectWorker({ ...workerInputs, answeredQuestion }),
			[QueueWorker.Plan]: () => runPlanWorker({ ...workerInputs, env, workOrderRunDir }),
			[QueueWorker.AutoPlan]: () => runAutoPlanWorker({ ...workerInputs, settings, env, workOrderRunDir, answeredQuestion }),
		};
		const outcome = await workers[ticket.worker]();

		if (outcome.question === undefined) {
			return outcome;
		}

		if (turn === maxRelayedQuestions) {
			return { error: `the worker is still asking after ${turn} answered question(s): ${outcome.question}` };
		}

		const answer = await relay.ask({ question: outcome.question, ticket, coordinatorRunId, coordinatorRunDir }).catch((error: unknown) => ({ error }));

		if (typeof answer !== 'string') {
			// `unanswered` means the human is away: the drain reads it to stop taking
			// on work nobody is there to steer.
			return { error: `the worker asked a question that could not be relayed: ${messageOf({ error: answer.error })}`, unanswered: true };
		}

		answeredQuestion = { question: outcome.question, answer };
	}
};
