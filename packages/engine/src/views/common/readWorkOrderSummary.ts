import { formatPlanAddress } from '#src/common/planAddress/formatPlanAddress.ts';
import type { PlanningProgress } from '#src/contracts/plan/progress/PlanningProgress.ts';
import type { ShippingProgress } from '#src/contracts/ship/ShippingProgress.ts';
import type { ShipResult } from '#src/contracts/ship/ShipResult.ts';
import { ShipStatus } from '#src/contracts/ship/ShipStatus.ts';
import type { RunListing } from '#src/contracts/views/RunListing.ts';
import { WorkOrderStatus } from '#src/contracts/views/workOrder/WorkOrderStatus.ts';
import type { WorkOrderSummary } from '#src/contracts/views/workOrder/WorkOrderSummary.ts';
import { PlanProgress } from '#src/contracts/workOrder/PlanProgress.ts';
import type { WorkOrderState } from '#src/contracts/workOrder/WorkOrderState.ts';
import { isPlanningStepLive } from '#src/plan/progress/isPlanningStepLive.ts';
import { readPlanningProgress } from '#src/plan/progress/readPlanningProgress.ts';
import { isShippingProgressLive } from '#src/ship/progress/isShippingProgressLive.ts';
import { readShippingProgress } from '#src/ship/progress/readShippingProgress.ts';
import { readShipResult } from '#src/ship/readShipResult.ts';
import { listRuns } from '#src/views/listRuns.ts';

/** First match wins, in the order the conditions are written. A counted plan is one carrying no exclusion. */
const deriveWorkOrderStatus = ({
	record,
	shipResult,
	shipProgress,
	shipLive,
}: {
	record: WorkOrderState;
	shipResult: ShipResult | undefined;
	shipProgress: ShippingProgress | undefined;
	shipLive: boolean;
}) => {
	const counted = record.plans.filter((plan) => plan.exclusion === undefined).map((plan) => plan.progress);
	const building = [...counted, ...(record.ticketBodyBuild === undefined ? [] : [record.ticketBodyBuild.progress])];
	const unended = shipProgress !== undefined && shipProgress.endedAt === undefined;
	const allBuilt =
		counted.length > 0 ? counted.every((progress) => progress === PlanProgress.Implemented) : record.ticketBodyBuild?.progress === PlanProgress.Implemented;
	let status: WorkOrderStatus = WorkOrderStatus.Planning;

	if (record.shipped !== undefined || shipResult?.status === ShipStatus.Shipped) {
		status = WorkOrderStatus.Shipped;
	} else if (unended && shipLive) {
		status = WorkOrderStatus.Shipping;
	} else if (shipResult?.status === ShipStatus.Blocked || unended || building.includes(PlanProgress.Failed)) {
		status = WorkOrderStatus.Blocked;
	} else if (building.includes(PlanProgress.Implementing)) {
		status = WorkOrderStatus.Building;
	} else if (allBuilt) {
		status = WorkOrderStatus.ReadyToShip;
	}

	return status;
};

/** Compared as instants rather than as text, and handed back as recorded. With nothing recorded, the epoch: an absence sorts last. */
const newestRecordedAt = ({
	record,
	shipResult,
	shipProgress,
	planning,
	runs,
}: {
	record: WorkOrderState;
	shipResult: ShipResult | undefined;
	shipProgress: ShippingProgress | undefined;
	planning: PlanningProgress[];
	runs: RunListing[];
}) => {
	const recorded = [
		...record.history.map((event) => event.at),
		...record.plans.flatMap((plan) => [plan.createdAt, plan.implementation?.startedAt, plan.implementation?.finishedAt, plan.exclusion?.at]),
		record.ticketBodyBuild?.startedAt,
		record.ticketBodyBuild?.finishedAt,
		record.shipRequest?.requestedAt,
		record.shipped?.at,
		shipResult?.mergedAt,
		shipProgress?.updatedAt,
		...planning.map((progress) => progress.updatedAt),
		...runs.map((run) => run.updatedAt),
	].filter((at) => at !== undefined);

	return recorded.reduce((newest, at) => (Date.parse(at) > Date.parse(newest) ? at : newest), new Date(0).toISOString());
};

/** Each plan's planning record, read by its address; a plan that never planned contributes nothing. */
const readPlanningRecords = async ({ cwd, name, record }: { cwd: string; name: string; record: WorkOrderState }) => {
	const read = await Promise.all(record.plans.map((plan) => readPlanningProgress({ cwd, name: formatPlanAddress({ workOrderName: name, planId: plan.id }) })));

	return read.filter((progress) => progress !== undefined);
};

interface Params {
	cwd: string;
	/** The folder's name under the work-orders directory. */
	name: string;
	/** The already-parsed record from that folder. */
	record: WorkOrderState;
}

/**
 * Everything a work order's row depends on, read once, so the list and the
 * detail view share one derivation. The ship records are read by branch, as
 * ship files them, never by joining a file name onto the folder.
 */
export const readWorkOrderSummary = async ({
	cwd,
	name,
	record,
}: Params): Promise<{ summary: WorkOrderSummary; shipResult: ShipResult | undefined; shipProgress: ShippingProgress | undefined; shipLive: boolean }> => {
	const [shipResult, { progress: shipProgress }, planning, runs] = await Promise.all([
		readShipResult({ cwd, branch: record.branch }),
		readShippingProgress({ cwd, branch: record.branch }),
		readPlanningRecords({ cwd, name, record }),
		listRuns({ cwd, workOrderName: name }),
	]);
	const shipLive = shipProgress !== undefined && isShippingProgressLive({ progress: shipProgress });
	const counted = record.plans.filter((plan) => plan.exclusion === undefined);
	const planningLive = planning.some((progress) => progress.steps.some((step) => isPlanningStepLive({ step })));
	const summary: WorkOrderSummary = {
		name,
		ticketRef: record.ticketRef,
		branch: record.branch,
		status: deriveWorkOrderStatus({ record, shipResult, shipProgress, shipLive }),
		plansDone: counted.filter((plan) => plan.progress === PlanProgress.Implemented).length,
		plansTotal: counted.length,
		prUrl: shipResult?.status === ShipStatus.Shipped ? shipResult.prUrl : undefined,
		updatedAt: newestRecordedAt({ record, shipResult, shipProgress, planning, runs }),
		live: shipLive || planningLive || runs.some((run) => run.live),
	};

	return { summary, shipResult, shipProgress, shipLive };
};
