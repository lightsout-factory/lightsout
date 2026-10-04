import { buildQueueAutoPlanInvocation } from '#src/agents/buildQueueAutoPlanInvocation.ts';
import type { AnsweredQuestion } from '#src/common/types/AnsweredQuestion.ts';
import type { Driver } from '#src/common/types/Driver.ts';
import type { LoadedConfig } from '#src/common/types/LoadedConfig.ts';
import { getDirsOutsideCwd } from '#src/common/utils/getDirsOutsideCwd.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig/LightsoutConfig.ts';
import { RunStatus } from '#src/contracts/run/RunStatus.ts';
import { WorkReport } from '#src/contracts/work/WorkReport.ts';
import { WorkReportStatus } from '#src/contracts/work/WorkReportStatus.ts';
import type { WorkOrderState } from '#src/contracts/workOrder/WorkOrderState.ts';
import { invokeAgentWithContract } from '#src/invoke/invokeAgentWithContract/invokeAgentWithContract.ts';
import { pathExists } from '#src/plan/common/paths/pathExists.ts';
import { planWorkspaceDir } from '#src/plan/planWorkspaceDir.ts';
import { readPlanningProgress } from '#src/plan/progress/readPlanningProgress.ts';
import type { QueueSettings } from '#src/queue/common/types/QueueSettings.ts';
import type { TicketSummary } from '#src/queue/common/types/TicketSummary.ts';
import type { WorkerOutcome } from '#src/queue/internal/common/types/WorkerOutcome.ts';
import { buildWorkOrderPlans } from '#src/queue/workers/internal/buildWorkOrderPlans.ts';
import { chooseAutoPlanTarget } from '#src/queue/workers/internal/chooseAutoPlanTarget.ts';
import { isPidAlive } from '#src/runState/isPidAlive.ts';
import { pullWorkOrderState } from '#src/workOrder/pullWorkOrderState.ts';

interface Params {
	/** The worktree the ticket is planned and built in. */
	cwd: string;
	ticket: TicketSummary;
	/** The work order's label — the folder the engine chooses a plan inside, and the first segment of the address it hands the session. */
	workOrderName: string;
	config: LightsoutConfig;
	/** The queue's startup config as it was read from disk, and its path, which every run this worker builds records. */
	loadedConfig: LoadedConfig;
	driver: Driver;
	/** Recorded as the harness name on a build from the ticket body. */
	driverName: string;
	settings: QueueSettings;
	/** The process environment the tracker credentials are read from. */
	env: NodeJS.ProcessEnv;
	/** The ticket's directory under the coordinator run, where each plan's commit message file is written. */
	workOrderRunDir: string;
	/** The answer to a question this worker asked, folded back in on re-invocation. */
	answeredQuestion?: AnsweredQuestion;
	onProgress?: (message: string) => void;
	/** The queue run its builds' owner records point at. */
	queueRunId: string;
}

/**
 * Once the session has returned, a step its turn started that is still recorded
 * running is a command left running past the turn's end, whether its process
 * has since died or is still alive, so liveness never decides this. Records
 * started before `sinceMs` belong to an earlier invocation. A missing or
 * unreadable record yields nothing.
 */
const findUnfinishedSteps = async ({ cwd, name, sinceMs }: { cwd: string; name: string; sinceMs: number }) => {
	const progress = await readPlanningProgress({ cwd, name });

	return (progress?.steps ?? []).filter((entry) => entry.status === RunStatus.Running && Date.parse(entry.startedAt) >= sinceMs);
};

/**
 * A live process is named with its pid but never signalled: once the command
 * has died its recorded pid may belong to an unrelated process, and a parked
 * ticket waits on a human who then has the pid.
 */
const describeUnfinishedSteps = ({ ticketRef, unfinished }: { ticketRef: string; unfinished: { step: string; pid: number }[] }) => {
	const steps = unfinished.map(({ step }) => step).join(', ');
	const live = unfinished
		.filter(({ pid }) => isPidAlive({ pid }))
		.map(({ step, pid }) => ` The ${step} step's process is still running as pid ${pid}.`)
		.join('');

	return `${ticketRef}'s auto-plan session ended while the engine command for its ${steps} step was still running, so no finished plan exists — nothing was built.${live}`;
};

/** @returns the outcome the worker stops on, or undefined once the plan is written and its folder is on disk */
const runPlanningSession = async ({
	cwd,
	ticket,
	planAddress,
	config,
	driver,
	settings,
	answeredQuestion,
	onProgress,
}: {
	cwd: string;
	ticket: TicketSummary;
	planAddress: string;
	config: LightsoutConfig;
	driver: Driver;
	settings: QueueSettings;
	answeredQuestion?: AnsweredQuestion;
	onProgress?: (message: string) => void;
}) => {
	// Under `write` permissions a harness only runs granted prefixes, so the
	// engine grants itself and the prompt is told the same words verbatim.
	const engineCli = `node ${process.argv[1]}`;
	const folder = await planWorkspaceDir({ cwd, name: planAddress });
	const sessionStartedMs = Date.now();
	const outcome = await invokeAgentWithContract({
		driver,
		cwd,
		invocation: buildQueueAutoPlanInvocation({
			ticketRef: ticket.identifier,
			ticketTitle: ticket.title,
			ticketBody: ticket.description,
			engineCli,
			planAddress,
			planFolder: folder,
			answeredQuestion,
		}),
		contract: WorkReport,
		model: config.model,
		effort: config.effort,
		permissions: config.permissions,
		timeoutMs: settings.workerTimeoutMs,
		allowedCommands: [...(config['agent-commands'] ?? []), engineCli],
		writableDirs: await getDirsOutsideCwd({ cwd, dirs: [folder] }),
		foregroundCommandsOnly: true,
	});

	// Ahead of every judgment of the report: a question or a failure reported
	// over a killed step describes a plan state that no longer exists.
	const unfinished = await findUnfinishedSteps({ cwd, name: planAddress, sinceMs: sessionStartedMs });

	if (unfinished.length > 0) {
		return { error: describeUnfinishedSteps({ ticketRef: ticket.identifier, unfinished }) };
	}

	if (!outcome.ok) {
		return { error: outcome.failure };
	}

	const report: WorkReport = outcome.report;
	const refusal = report.failures[0] ?? report.summary;

	if (report.status === WorkReportStatus.TerminatedAmbiguity) {
		return { question: refusal };
	}

	if (report.status !== WorkReportStatus.Complete) {
		return { error: refusal };
	}

	if (!(await pathExists({ path: folder }))) {
		return { error: `${ticket.identifier}'s auto-plan session reported a finished plan, but no plan folder exists at ${folder} — nothing was built` };
	}

	onProgress?.(`${ticket.identifier} is planned and published; the engine now runs the implement pipeline on its plan folder`);

	return undefined;
};

/**
 * The engine, not the session, chooses which plan is planned, so no name is
 * ever derived twice.
 *
 * The session stops once the plan is published, and the engine builds it: a
 * build takes hours, so no build lives inside an agent session that could take
 * it down part-way.
 */
export const runAutoPlanWorker = async ({
	cwd,
	ticket,
	workOrderName,
	config,
	loadedConfig,
	driver,
	driverName,
	settings,
	env,
	workOrderRunDir,
	answeredQuestion,
	onProgress,
	queueRunId,
}: Params): Promise<WorkerOutcome> => {
	const chosen = await chooseAutoPlanTarget({ cwd, workOrderName, ticket, config, env, onProgress });

	if ('error' in chosen) {
		return { error: chosen.error };
	}

	const build = ({ record }: { record: WorkOrderState }) =>
		buildWorkOrderPlans({
			cwd,
			workOrderName,
			ticket,
			record,
			config,
			loadedConfig,
			env,
			driver,
			driverName,
			workOrderRunDir,
			allowTicketBodyBuild: false,
			onProgress,
			queueRunId,
		});

	if (chosen.address === undefined) {
		const built = await build({ record: chosen.record });

		return built.open === undefined ? built : { open: `no plan is waiting to be planned on ${ticket.identifier}: ${built.open}` };
	}

	const planAddress = chosen.address;
	const stopped = await runPlanningSession({ cwd, ticket, planAddress, config, driver, settings, answeredQuestion, onProgress });

	if (stopped !== undefined) {
		return stopped;
	}

	// Read again rather than reused: publishing the plan moved its progress to
	// ready to implement, and the build loop reads that progress.
	const planned = await pullWorkOrderState({ cwd, name: workOrderName, config, env, onProgress });

	if ('error' in planned) {
		return { error: planned.error };
	}

	if (planned.record === undefined) {
		return { error: `work order ${workOrderName} no longer has a record, so the plan ${planAddress} the session wrote could not be built` };
	}

	return build({ record: planned.record });
};
