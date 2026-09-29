import type { AnsweredQuestion } from '#src/common/types/AnsweredQuestion.ts';
import { messageOf } from '#src/common/utils/messageOf.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig.ts';
import { RunStatus } from '#src/contracts/run/RunStatus.ts';
import { runDirectWork } from '#src/direct/runDirectWork.ts';
import type { Driver } from '#src/drivers/common/types/Driver.ts';
import { QueueWorker } from '#src/queue/common/constants/QueueWorker.ts';
import type { QuestionRelay } from '#src/queue/common/types/QuestionRelay.ts';
import type { QueueSettings } from '#src/queue/common/types/QueueSettings.ts';
import type { TicketSummary } from '#src/queue/common/types/TicketSummary.ts';
import type { RunnableTicket } from '#src/queue/internal/common/types/RunnableTicket.ts';
import type { WorkerOutcome } from '#src/queue/internal/common/types/WorkerOutcome.ts';
import { buildWorkOrderPlans } from '#src/queue/workers/internal/buildWorkOrderPlans.ts';
import { toWorkerOutcome } from '#src/queue/workers/internal/common/utils/toWorkerOutcome.ts';
import { runAutoPlanWorker } from '#src/queue/workers/internal/runAutoPlanWorker.ts';
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

/**
 * The direct worker, its run result read back in the same three terms.
 *
 * The build goes through the body-build lifecycle, which records it on the work
 * order record when that record is a single-plan one holding no plan 001 — the
 * build the ship check then reads — and writes nothing otherwise.
 */
const runDirectWorker = async ({
	cwd,
	workOrderName,
	ticket,
	config,
	driver,
	driverName,
	answeredQuestion,
	onProgress,
}: {
	cwd: string;
	workOrderName: string;
	ticket: TicketSummary;
	config: LightsoutConfig;
	driver: Driver;
	driverName: string;
	answeredQuestion?: AnsweredQuestion;
	onProgress?: (message: string) => void;
}): Promise<WorkerOutcome> => {
	const outcome = await runWorkOrderBodyBuildLifecycle({
		cwd,
		workOrderName,
		run: ({ runId }) =>
			runDirectWork({
				cwd,
				ticketBody: ticket.description,
				ticketRef: ticket.identifier,
				runId,
				driver,
				driverName,
				config,
				answeredQuestion,
				onProgress,
			}),
	});

	return toWorkerOutcome({
		outcome,
		onFailedRun: ({ stated, result }) => (result.manifest.status === RunStatus.Escalated ? { question: stated } : { error: stated }),
	});
};

/**
 * The plan worker: implement the plan or plans the ticket already carries.
 *
 * A ticket with a record of its own is built plan by plan through
 * `buildWorkOrderPlans`: its plans that are ready to implement go in numeric order,
 * each committed as its own commit, and the loop decides whether the ticket then
 * ships, stays open, or parks.
 *
 * A ticket with no record carries no published plan — publishing a plan is what
 * writes the record. That is not an error: shaping may have finished on approved
 * brainstorm material, whose outcome lives in the ticket body. It then builds
 * from the body, announced so the run is legible.
 */
const runPlanWorker = async ({
	cwd,
	ticket,
	workOrderName,
	config,
	driver,
	driverName,
	env,
	workOrderRunDir,
	onProgress,
}: {
	cwd: string;
	ticket: TicketSummary;
	workOrderName: string;
	config: LightsoutConfig;
	driver: Driver;
	driverName: string;
	env: NodeJS.ProcessEnv;
	workOrderRunDir: string;
	onProgress?: (message: string) => void;
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
			env,
			driver,
			driverName,
			workOrderRunDir,
			allowTicketBodyBuild: true,
			onProgress,
		});
	}

	onProgress?.(`${ticket.identifier} carries no published plan, so it is built from the ticket body`);

	return runDirectWorker({ cwd, workOrderName, ticket, config, driver, driverName, onProgress });
};

/**
 * The worker, run until it stops asking: every question goes to the one
 * terminal and comes back as an answer the next invocation carries.
 *
 * A worker still asking after the last turn parks, and so does a relay with no
 * terminal behind it — one ticket that cannot be answered must never take the
 * other in-flight workers down with it.
 */
export const runWorkerWithRelay = async ({
	worktreePath,
	workOrderName,
	ticket,
	config,
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
	// The relay's own policy, deliberately its own number rather than the
	// gate-fix retry count it happens to equal: tuning how many times a red gate
	// is retried must never silently change how many times the user is asked.
	const maxRelayedQuestions = 2;
	let answeredQuestion: AnsweredQuestion | undefined;

	for (let turn = 0; ; turn += 1) {
		const workers: Record<QueueWorker, () => Promise<WorkerOutcome>> = {
			[QueueWorker.Direct]: () => runDirectWorker({ cwd: worktreePath, workOrderName, ticket, config, driver, driverName, answeredQuestion, onProgress }),
			[QueueWorker.Plan]: () => runPlanWorker({ cwd: worktreePath, ticket, workOrderName, config, driver, driverName, env, workOrderRunDir, onProgress }),
			[QueueWorker.AutoPlan]: () =>
				runAutoPlanWorker({
					cwd: worktreePath,
					ticket,
					workOrderName,
					config,
					driver,
					driverName,
					settings,
					env,
					workOrderRunDir,
					answeredQuestion,
					onProgress,
				}),
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
			// `unanswered` marks the one park that means the human is away — the
			// relay throws only when a question can never be answered, and the
			// drain reads the flag to stop taking on work nobody is there to steer.
			return { error: `the worker asked a question that could not be relayed: ${messageOf({ error: answer.error })}`, unanswered: true };
		}

		answeredQuestion = { question: outcome.question, answer };
	}
};
