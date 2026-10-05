import type { WorkOrderState } from '#src/contracts/workOrder/WorkOrderState.ts';
import type { WorkOrderSyncState } from '#src/contracts/workOrder/WorkOrderSyncState.ts';

interface Params {
	record: WorkOrderState;
	syncState: WorkOrderSyncState | undefined;
}

/**
 * A marker the sidecar does not hold means the plan was republished elsewhere,
 * so building or publishing over it would silently lose that work.
 */
export const findDivergentPlanIds = ({ record, syncState }: Params): string[] =>
	record.plans.filter((plan) => plan.publishedMarker !== undefined && plan.publishedMarker !== syncState?.planMarkers[plan.id]).map((plan) => plan.id);
