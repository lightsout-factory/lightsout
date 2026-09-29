import { buildQueueAutoPlanInvocation } from '#src/agents/buildQueueAutoPlanInvocation.ts';
import type { AnsweredQuestion } from '#src/common/types/AnsweredQuestion.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig.ts';
import { WorkReport } from '#src/contracts/work/WorkReport.ts';
import { WorkReportStatus } from '#src/contracts/work/WorkReportStatus.ts';
import type { WorkOrderState } from '#src/contracts/workOrder/WorkOrderState.ts';
import type { Driver } from '#src/drivers/common/types/Driver.ts';
import { invokeAgentWithContract } from '#src/invoke/invokeAgentWithContract.ts';
import { pathExists } from '#src/plan/common/paths/pathExists.ts';
import { planWorkspaceDir } from '#src/plan/planWorkspaceDir.ts';
import type { QueueSettings } from '#src/queue/common/types/QueueSettings.ts';
import type { TicketSummary } from '#src/queue/common/types/TicketSummary.ts';
import type { WorkerOutcome } from '#src/queue/internal/common/types/WorkerOutcome.ts';
import { buildWorkOrderPlans } from '#src/queue/workers/internal/buildWorkOrderPlans.ts';
import { chooseAutoPlanTarget } from '#src/queue/workers/internal/chooseAutoPlanTarget.ts';
import { pullWorkOrderState } from '#src/workOrder/pullWorkOrderState.ts';

interface Params {
	/** The worktree the ticket is planned and built in. */
	cwd: string;
	ticket: TicketSummary;
	/** The work order's label — the folder the engine chooses a plan inside, and the first segment of the address it hands the session. */
	workOrderName: string;
	config: LightsoutConfig;
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
}

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
	const outcome = await invokeAgentWithContract({
		driver,
		cwd,
		invocation: buildQueueAutoPlanInvocation({
			ticketRef: ticket.identifier,
			ticketTitle: ticket.title,
			ticketBody: ticket.description,
			engineCli,
			planAddress,
			answeredQuestion,
		}),
		contract: WorkReport,
		model: config.model,
		effort: config.effort,
		permissions: config.permissions,
		timeoutMs: settings.workerTimeoutMs,
		allowedCommands: [...(config['agent-commands'] ?? []), engineCli],
	});

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

	const folder = await planWorkspaceDir({ cwd, name: planAddress });

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
	driver,
	driverName,
	settings,
	env,
	workOrderRunDir,
	answeredQuestion,
	onProgress,
}: Params): Promise<WorkerOutcome> => {
	const chosen = await chooseAutoPlanTarget({ cwd, workOrderName, ticket, config, env, onProgress });

	if ('error' in chosen) {
		return { error: chosen.error };
	}

	const build = ({ record }: { record: WorkOrderState }) =>
		buildWorkOrderPlans({ cwd, workOrderName, ticket, record, config, env, driver, driverName, workOrderRunDir, allowTicketBodyBuild: false, onProgress });

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
