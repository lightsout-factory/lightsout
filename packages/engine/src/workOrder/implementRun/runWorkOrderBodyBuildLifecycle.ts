import { randomUUID } from 'node:crypto';
import type { WorkOrderPlanOutcome } from '#src/common/types/WorkOrderPlanOutcome.ts';
import { RunStatus } from '#src/contracts/run/RunStatus.ts';
import { PlanProgress } from '#src/contracts/workOrder/PlanProgress.ts';
import type { WorkOrderState } from '#src/contracts/workOrder/WorkOrderState.ts';
import type { PipelineResult } from '#src/pipeline/PipelineResult.ts';
import { recordHandBuiltShipAuthorizationWithdrawal } from '#src/workOrder/common/recordHandBuiltShipAuthorizationWithdrawal.ts';
import { updateLocalWorkOrderState } from '#src/workOrder/common/updateLocalWorkOrderState.ts';
import { isPlanlessWorkOrder } from '#src/workOrder/isPlanlessWorkOrder.ts';
import { readWorkOrderState } from '#src/workOrder/readWorkOrderState.ts';

interface Params {
	/** The record is resolved through its primary checkout. */
	cwd: string;
	workOrderName: string;
	/** A fresh run must be created under exactly the id it is handed. */
	run: (params: { runId: string }) => Promise<PipelineResult>;
}

type TicketBodyBuild = NonNullable<WorkOrderState['ticketBodyBuild']>;

/**
 * Re-asks inside the lock whether the record is still plan-less: one that gained
 * plan 001 since the first read must not get a build no ship rule would read. A
 * hand-built authorization is withdrawn in the same locked change, before the run
 * starts, so on this machine no moment exists where a build is running and an
 * authorization still stands.
 */
const recordImplementing = ({ cwd, workOrderName, build }: { cwd: string; workOrderName: string; build: TicketBodyBuild }) =>
	updateLocalWorkOrderState({
		cwd,
		name: workOrderName,
		change: (current) => {
			if (current === undefined) {
				return { error: `work order ${workOrderName} no longer has a record, so its build from the ticket body cannot be recorded as being implemented` };
			}

			if (!isPlanlessWorkOrder({ record: current })) {
				return {
					error: `work order ${workOrderName} is no longer a single-plan work order holding no plan 001, so it is not built from the ticket body — build it through its plans instead`,
				};
			}

			return recordHandBuiltShipAuthorizationWithdrawal({
				record: { ...current, ticketBodyBuild: build },
				detail: `a build from the ticket body started under run ${build.runId}, so the hand-built authorization no longer stands`,
				at: build.startedAt,
			});
		},
	});

/** A paused run leaves the implementing mark it started under. */
const recordOutcome = async ({ cwd, workOrderName, build, result }: { cwd: string; workOrderName: string; build: TicketBodyBuild; result: PipelineResult }) => {
	const failed = result.manifest.status === RunStatus.Failed || result.manifest.status === RunStatus.Escalated;

	if (!result.ok && !failed) {
		return undefined;
	}

	const progress = result.ok ? PlanProgress.Implemented : PlanProgress.Failed;
	const finishedAt = new Date().toISOString();
	const updated = await updateLocalWorkOrderState({
		cwd,
		name: workOrderName,
		change: (current) =>
			current === undefined
				? { error: `work order ${workOrderName} no longer has a record, so the outcome of its build from the ticket body could not be recorded on it` }
				: { ...current, ticketBodyBuild: { ...build, progress, finishedAt } },
	});

	return 'error' in updated ? updated.error : undefined;
};

/**
 * `ticketBodyBuild` is what the single-plan ship check reads when there is no
 * plan 001. A record that is not plan-less gets nothing written, because no
 * ship rule would read it. Every write is local; publishing stays with the
 * commands that already publish the record.
 */
export const runWorkOrderBodyBuildLifecycle = async ({ cwd, workOrderName, run }: Params): Promise<WorkOrderPlanOutcome> => {
	const read = await readWorkOrderState({ cwd, name: workOrderName });

	if ('error' in read) {
		return { refusal: read.error };
	}

	const { record } = read;

	if (record === undefined || !isPlanlessWorkOrder({ record })) {
		return { result: await run({ runId: randomUUID() }) };
	}

	const build: TicketBodyBuild = { runId: randomUUID(), progress: PlanProgress.Implementing, startedAt: new Date().toISOString() };
	const started = await recordImplementing({ cwd, workOrderName, build });

	if ('error' in started) {
		return { refusal: started.error };
	}

	const result = await run({ runId: build.runId });
	const recordError = await recordOutcome({ cwd, workOrderName, build, result });

	return recordError === undefined ? { result } : { result, recordError };
};
