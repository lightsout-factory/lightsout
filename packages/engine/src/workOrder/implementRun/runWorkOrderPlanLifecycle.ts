import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { readGitHeadCommit } from '#src/common/git/readGitHeadCommit.ts';
import { parsePlanAddress } from '#src/common/planAddress/parsePlanAddress/parsePlanAddress.ts';
import { sha256 } from '#src/common/sha256.ts';
import { workOrderFolderDir } from '#src/common/workspace/workOrderFolderDir.ts';
import { RunStatus } from '#src/contracts/run/RunStatus.ts';
import { PlanProgress } from '#src/contracts/workOrder/PlanProgress.ts';
import type { WorkOrderPlan } from '#src/contracts/workOrder/WorkOrderPlan.ts';
import type { WorkOrderState } from '#src/contracts/workOrder/WorkOrderState.ts';
import type { PipelineResult } from '#src/pipeline/PipelineResult.ts';
import { durablePlanFiles } from '#src/plan/publish/durablePlanFiles.ts';
import type { WorkOrderPlanOutcome } from '#src/workOrder/common/types/WorkOrderPlanOutcome.ts';
import { findPlanImplementationBlocker } from '#src/workOrder/findPlanImplementationBlocker.ts';
import { findDivergentPlanIds } from '#src/workOrder/internal/common/utils/findDivergentPlanIds.ts';
import { isWholePlanRun } from '#src/workOrder/internal/common/utils/isWholePlanRun.ts';
import { readWorkOrderSyncState } from '#src/workOrder/internal/common/utils/readWorkOrderSyncState.ts';
import { readWorkOrderState } from '#src/workOrder/readWorkOrderState.ts';
import { updateLocalWorkOrderState } from '#src/workOrder/updateLocalWorkOrderState.ts';

interface Params {
	/** HEAD is read and the plan's durable files are hashed here; the record is resolved through its primary checkout. */
	cwd: string;
	/** Undefined for a plan outside the plans directory. */
	name: string | undefined;
	/** Absent for a fresh run, which is handed `runId` or a newly minted id. */
	resumeRunId?: string;
	/** A fresh run's pre-minted id, so a detached launch's parent can name the run before it starts. Ignored when resuming. */
	runId?: string;
	/** A fresh run must be created under exactly the id it is handed. */
	run: (params: { runId: string }) => Promise<PipelineResult>;
}

const readPlanSnapshot = async ({ cwd, name }: { cwd: string; name: string }) => {
	const durable = await durablePlanFiles({ cwd, name });
	const snapshot: { name: string; sha256: string }[] = [];

	for (const file of durable.files) {
		const content = await readFile(file.path).catch(() => undefined);

		if (content !== undefined) {
			snapshot.push({ name: file.name, sha256: sha256({ content }) });
		}
	}

	return snapshot;
};

const withPlan = ({ record, plan }: { record: WorkOrderState; plan: WorkOrderPlan }): WorkOrderState => ({
	...record,
	plans: record.plans.map((candidate) => (candidate.id === plan.id ? plan : candidate)),
});

/**
 * Re-asks the order rules inside the lock: minutes may pass after the first
 * read, and a record another command changed meanwhile must not be overwritten
 * with a decision taken against the old one.
 */
const recordImplementing = ({
	cwd,
	workOrderName,
	planId,
	runId,
	headCommit,
}: {
	cwd: string;
	workOrderName: string;
	planId: string;
	runId: string;
	headCommit: string | undefined;
}) =>
	updateLocalWorkOrderState({
		cwd,
		name: workOrderName,
		change: (current) => {
			if (current === undefined) {
				return { error: `work order ${workOrderName} no longer has a record, so plan ${planId} cannot be recorded as being implemented` };
			}

			const blocker = findPlanImplementationBlocker({ record: current, planId });

			if (blocker !== undefined) {
				return { error: blocker };
			}

			const plan = current.plans.find((candidate) => candidate.id === planId);

			if (plan === undefined) {
				return { error: `work order ${workOrderName} holds no plan ${planId}` };
			}

			// A plan already implementing or failed keeps the start its first run
			// recorded, across every repair.
			const started =
				(plan.progress === PlanProgress.Implementing || plan.progress === PlanProgress.Failed) && plan.implementation !== undefined
					? { startedAt: plan.implementation.startedAt, startCommit: plan.implementation.startCommit }
					: { startedAt: new Date().toISOString(), startCommit: headCommit ?? '' };

			return withPlan({ record: current, plan: { ...plan, progress: PlanProgress.Implementing, implementation: { runId, ...started } } });
		},
	});

const needsFreshStart = ({ plan }: { plan: WorkOrderPlan | undefined }) =>
	plan?.implementation === undefined || (plan.progress !== PlanProgress.Implementing && plan.progress !== PlanProgress.Failed);

const recordOutcome = async ({
	cwd,
	workOrderName,
	planId,
	name,
	result,
}: {
	cwd: string;
	workOrderName: string;
	planId: string;
	name: string;
	result: PipelineResult;
}) => {
	const whole = await isWholePlanRun({ cwd, name, planPath: result.manifest.plan, pipeline: result.manifest.pipeline });
	const failed = result.manifest.status === RunStatus.Failed || result.manifest.status === RunStatus.Escalated;

	// A pass that covered one phase, and a pause, both leave the plan exactly as
	// the pre-run write left it: implementing, under this run's id.
	if (!(result.ok && whole) && !failed) {
		return undefined;
	}

	const snapshot = result.ok ? await readPlanSnapshot({ cwd, name }) : undefined;
	const finishedAt = new Date().toISOString();
	const updated = await updateLocalWorkOrderState({
		cwd,
		name: workOrderName,
		change: (current) => {
			const plan = current?.plans.find((candidate) => candidate.id === planId);

			if (current === undefined || plan === undefined) {
				return { error: `work order ${workOrderName} no longer holds plan ${planId}, so the run's outcome could not be recorded against it` };
			}

			const implementation = plan.implementation ?? { runId: result.manifest.runId, startedAt: finishedAt, startCommit: '' };

			return withPlan({
				record: current,
				plan:
					snapshot === undefined
						? { ...plan, progress: PlanProgress.Failed, implementation }
						: { ...plan, progress: PlanProgress.Implemented, implementation: { ...implementation, finishedAt, snapshot } },
			});
		},
	});

	return 'error' in updated ? updated.error : undefined;
};

/**
 * Every write is local: progress is this machine's working state, and the next
 * `lightsout work-order` subcommand or `plan publish` puts it on the ticket.
 *
 * A pipeline that throws, or exits before its run exists, deliberately leaves
 * the plan `implementing` under an id no manifest carries: the next run
 * overwrites the id and keeps the start, and restoring the old progress would
 * have to happen outside the wrappers that call `process.exit` around this.
 */
export const runWorkOrderPlanLifecycle = async ({ cwd, name, resumeRunId, runId: preMintedRunId, run }: Params): Promise<WorkOrderPlanOutcome> => {
	const address = name === undefined ? undefined : parsePlanAddress({ name });

	if (name === undefined || address === undefined) {
		return { result: await run({ runId: resumeRunId ?? preMintedRunId ?? randomUUID() }) };
	}

	const { workOrderName, planId } = address;
	const read = await readWorkOrderState({ cwd, name: workOrderName });

	if ('error' in read) {
		return { refusal: read.error };
	}

	const { record } = read;

	if (record === undefined) {
		return { result: await run({ runId: resumeRunId ?? preMintedRunId ?? randomUUID() }) };
	}

	const blocker = findPlanImplementationBlocker({ record, planId });

	if (blocker !== undefined) {
		return { refusal: blocker };
	}

	const syncState = await readWorkOrderSyncState({ workOrderFolder: await workOrderFolderDir({ cwd, name: workOrderName }) });

	if (findDivergentPlanIds({ record, syncState }).includes(planId)) {
		return {
			refusal: `plan ${planId} was published from another machine after this one last saw it, so the copy here may not be what the ticket carries — run \`lightsout work-order sync --name ${workOrderName} --keep published\` to take the ticket's copy, or \`--keep local\` to publish this machine's over it`,
		};
	}

	const plan = record.plans.find((candidate) => candidate.id === planId);
	const fresh = needsFreshStart({ plan });
	const headCommit = fresh ? await readGitHeadCommit({ cwd }) : undefined;

	if (fresh && headCommit === undefined) {
		return {
			refusal: `git could not name the commit ${cwd} is standing on, and the implementation of plan ${planId} on work order ${workOrderName} is recorded against the commit it starts from`,
		};
	}

	const runId = resumeRunId ?? preMintedRunId ?? randomUUID();
	const started = await recordImplementing({ cwd, workOrderName, planId, runId, headCommit });

	if ('error' in started) {
		return { refusal: started.error };
	}

	const result = await run({ runId });
	const recordError = await recordOutcome({ cwd, workOrderName, planId, name, result });
	const note =
		result.ok && !(await isWholePlanRun({ cwd, name, planPath: result.manifest.plan, pipeline: result.manifest.pipeline }))
			? `this run covered one phase file of plan ${planId} and it passed; the implementation of plan ${planId} on work order ${workOrderName} has not finished until the whole plan runs`
			: undefined;

	return { result, recordError, note };
};
