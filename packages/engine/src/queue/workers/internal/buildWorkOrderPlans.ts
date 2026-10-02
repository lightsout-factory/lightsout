import { readGitChangedFiles } from '#src/common/git/readGitChangedFiles.ts';
import { formatPlanAddress } from '#src/common/planAddress/formatPlanAddress.ts';
import { planNumberOf } from '#src/common/planAddress/planNumberOf.ts';
import { isGeneratedPath } from '#src/common/sourceFiles/isGeneratedPath.ts';
import type { LoadedConfig } from '#src/common/types/LoadedConfig.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig.ts';
import { PlanProgress } from '#src/contracts/workOrder/PlanProgress.ts';
import { WorkOrderMode } from '#src/contracts/workOrder/WorkOrderMode.ts';
import type { WorkOrderState } from '#src/contracts/workOrder/WorkOrderState.ts';
import type { Driver } from '#src/drivers/common/types/Driver.ts';
import { pathExists } from '#src/plan/common/paths/pathExists.ts';
import { planWorkspaceDir } from '#src/plan/planWorkspaceDir.ts';
import type { TicketSummary } from '#src/queue/common/types/TicketSummary.ts';
import type { WorkerOutcome } from '#src/queue/internal/common/types/WorkerOutcome.ts';
import type { WorkOrderPlanStep } from '#src/queue/workers/internal/common/types/WorkOrderPlanStep.ts';
import { buildFromTicketBody } from '#src/queue/workers/internal/common/utils/buildFromTicketBody.ts';
import { buildPlanlessWorkOrder } from '#src/queue/workers/internal/common/utils/buildPlanlessWorkOrder.ts';
import { decideTicketOutcome } from '#src/queue/workers/internal/common/utils/decideTicketOutcome.ts';
import { findStalledPlanRefusal } from '#src/queue/workers/internal/common/utils/findStalledPlanRefusal.ts';
import { settleLeftoverWork } from '#src/queue/workers/internal/common/utils/settleLeftoverWork.ts';
import { runPlanFolderPipeline } from '#src/queue/workers/internal/runPlanFolderPipeline.ts';
import { isPlanlessWorkOrder } from '#src/workOrder/isPlanlessWorkOrder.ts';
import { readWorkOrderState } from '#src/workOrder/readWorkOrderState.ts';
import { restoreWorkOrderPlan } from '#src/workOrder/restoreWorkOrderPlan.ts';

interface Params {
	/** The work order's worktree: where each plan is restored, built and committed. */
	cwd: string;
	/** The work order's label — the first segment of every plan address it holds. A prefixed branch would not parse as one, which is why the label and not the branch is what an address is built from. */
	workOrderName: string;
	ticket: TicketSummary;
	/** The record as the caller's pull answered it. */
	record: WorkOrderState;
	config: LightsoutConfig;
	/** The queue's startup config as it was read from disk, and its path, which every run this builds records. */
	loadedConfig: LoadedConfig;
	/** The process environment the tracker credentials are read from. */
	env: NodeJS.ProcessEnv;
	driver: Driver;
	/** Recorded as the harness name on a build from the ticket body. */
	driverName: string;
	/** The ticket's directory under the coordinator run, where each plan's commit message file is written. */
	workOrderRunDir: string;
	/** True only for the plan worker: a single-plan work order whose plan 001 is still being planned, or that holds no plan 001, is then built from the ticket body. */
	allowTicketBodyBuild: boolean;
	onProgress?: (message: string) => void;
	/** The queue run whose owner record answers for every run this builds. */
	queueRunId: string;
}

/** Generated paths are left out: build output is the pre-ship step's to commit, never a plan's. */
const readLeftoverWork = async ({ cwd, config }: { cwd: string; config: LightsoutConfig }) => {
	const changed = (await readGitChangedFiles({ cwd })) ?? [];

	return changed.filter((path) => !isGeneratedPath({ path, generated: config.generated ?? [] }));
};

/**
 * The contract keeps `plans` in number order, so nothing sorts, and nothing
 * skips past a plan that is not ready to implement.
 */
const findNextPlanToBuild = ({ record }: { record: WorkOrderState }) =>
	record.plans.find((plan) => plan.exclusion === undefined && plan.progress !== PlanProgress.Implemented);

const takePlanBeingPlanned = ({ step, allowTicketBodyBuild }: { step: WorkOrderPlanStep; allowTicketBodyBuild: boolean }) => {
	const { record, plan } = step;

	if (record.mode !== WorkOrderMode.SinglePlan) {
		return { open: `plan ${plan.id} on work order ${record.name} is still being planned, so the work order stays open until that plan is ready to implement` };
	}

	if (!allowTicketBodyBuild || planNumberOf({ id: plan.id }) !== 1) {
		return {
			error: `plan ${plan.id} on work order ${record.name} is still being planned, so the work order has nothing ready to implement — plan it with \`lightsout plan --name ${formatPlanAddress({ workOrderName: record.name, planId: plan.id })}\``,
		};
	}

	return buildFromTicketBody({ step });
};

const buildReadyPlan = async ({ step }: { step: WorkOrderPlanStep }) => {
	const { cwd, record, plan, config, loadedConfig, env, driver, onProgress, queueRunId } = step;
	const address = formatPlanAddress({ workOrderName: record.name, planId: plan.id });

	if (!(await pathExists({ path: await planWorkspaceDir({ cwd, name: address }) }))) {
		const restored = await restoreWorkOrderPlan({ cwd, address, config, env, onProgress });

		if ('error' in restored) {
			return { error: restored.error };
		}

		if (restored.restored.length === 0) {
			const carrier = record.ticketRef === undefined ? '' : ` on ${record.ticketRef}`;

			return { error: `plan ${plan.id} is ready to implement on work order ${record.name}, but nothing${carrier} carries published files for it` };
		}
	}

	return runPlanFolderPipeline({ cwd, name: address, config, loadedConfig, driver, onProgress, queueRunId });
};

/**
 * A pass the record does not show as a finished implementation — a run over one
 * phase file of the plan, say — would otherwise make the next turn take the
 * same plan again.
 */
const confirmPlanImplemented = async ({ step, workOrderName }: { step: WorkOrderPlanStep; workOrderName: string }) => {
	const { cwd, plan } = step;
	const reread = await readWorkOrderState({ cwd, name: workOrderName });

	if ('error' in reread) {
		return reread;
	}

	const { record } = reread;

	if (record?.plans.find((candidate) => candidate.id === plan.id)?.progress !== PlanProgress.Implemented) {
		return {
			error: `plan ${plan.id} on work order ${workOrderName} was built and passed, but its implementation is not recorded as finished, so the queue stopped rather than build it again`,
		};
	}

	return { record };
};

/**
 * Lowest number first, because the plans share one branch and a later plan is
 * built on the commit the plans before it left. The queue repairs neither a
 * lower plan still being planned nor one whose implementation has not finished.
 *
 * This loop writes nothing to the record itself — `runPlanFolderPipeline`'s
 * lifecycle helper does — and neither pushes nor fetches.
 *
 * @returns success once nothing is left to build and the ticket may ship, the reason it stays open, or the reason it parks
 */
export const buildWorkOrderPlans = async ({
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
	allowTicketBodyBuild,
	onProgress,
	queueRunId,
}: Params): Promise<WorkerOutcome> => {
	const stepInputs = { cwd, ticket, config, loadedConfig, env, driver, driverName, workOrderRunDir, onProgress, queueRunId };

	if (allowTicketBodyBuild && isPlanlessWorkOrder({ record })) {
		return buildPlanlessWorkOrder({ step: { ...stepInputs, record }, workOrderName });
	}

	// Read before anything is built, so it holds only work that was already there.
	const leftover = await readLeftoverWork({ cwd, config });
	let current = record;
	let settled = false;

	for (;;) {
		const plan = findNextPlanToBuild({ record: current });

		if (plan === undefined) {
			return decideTicketOutcome({ record: current });
		}

		const step: WorkOrderPlanStep = { ...stepInputs, record: current, plan };
		// Asked before any leftover work is settled: a failed or paused build's
		// partial changes are what `lightsout resume` expects to find in the tree.
		const stalled = findStalledPlanRefusal({ record: current, plan });

		if (stalled !== undefined) {
			return { error: stalled };
		}

		if (!settled) {
			const unsettled = await settleLeftoverWork({ step, leftover });

			if (unsettled !== undefined) {
				return { error: unsettled };
			}

			settled = true;
		}

		const built = plan.progress === PlanProgress.Planning ? await takePlanBeingPlanned({ step, allowTicketBodyBuild }) : await buildReadyPlan({ step });

		if (built.error !== undefined || built.open !== undefined) {
			return built;
		}

		const confirmed = await confirmPlanImplemented({ step, workOrderName });

		if ('error' in confirmed) {
			return { error: confirmed.error };
		}

		current = confirmed.record;
	}
};
