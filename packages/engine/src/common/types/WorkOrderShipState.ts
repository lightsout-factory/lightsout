import type { WorkOrderShipStateKind } from '#src/common/constants/WorkOrderShipStateKind.ts';
import type { WorkOrderShipRequestedState } from '#src/common/types/WorkOrderShipRequestedState.ts';

/** What a record says about its shipping, one variant per line `lightsout work-order show` prints. */
export type WorkOrderShipState =
	| { kind: typeof WorkOrderShipStateKind.Shipped; mergeCommit: string }
	| { kind: typeof WorkOrderShipStateKind.ShipRequestMissing; includedPlanIds: string[] }
	| WorkOrderShipRequestedState
	| { kind: typeof WorkOrderShipStateKind.PlanOneWaiting; planId: string }
	| { kind: typeof WorkOrderShipStateKind.PlanOneImplemented; planId: string }
	| { kind: typeof WorkOrderShipStateKind.PlanOneExcluded; planId: string; reason: string }
	| { kind: typeof WorkOrderShipStateKind.TicketBodyUnbuilt }
	| { kind: typeof WorkOrderShipStateKind.TicketBodyBuilding; runId: string }
	| { kind: typeof WorkOrderShipStateKind.TicketBodyFailed; runId: string }
	| { kind: typeof WorkOrderShipStateKind.TicketBodyPassed; runId: string }
	| { kind: typeof WorkOrderShipStateKind.HandBuiltAuthorized; by: string; at: string };
