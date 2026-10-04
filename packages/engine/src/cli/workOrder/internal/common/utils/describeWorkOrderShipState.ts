import { WorkOrderShipStateKind } from '#src/common/constants/WorkOrderShipStateKind.ts';
import { formatRequestShipCommand } from '#src/common/formatRequestShipCommand.ts';
import type { WorkOrderShipRequestedState } from '#src/common/types/WorkOrderShipRequestedState.ts';
import type { WorkOrderShipState } from '#src/common/types/WorkOrderShipState.ts';

interface Params {
	/** The work order's label, named in the command a drifted ship request is answered with. */
	name: string;
	state: WorkOrderShipState;
}

/** A drifted request is refused by the ship check, so the line says how to file it again rather than when it ships. */
const describeShipRequest = ({ name, state }: { name: string; state: WorkOrderShipRequestedState }) =>
	state.missingPlanIds.length === 0 && state.stalePlanIds.length === 0
		? `ship request: ${state.planIds.join(', ')} — the work order ships once every one of them is implemented`
		: `ship request: ${state.planIds.join(', ')} — it no longer names the plans the work order holds, so request shipping again with \`${formatRequestShipCommand({ name, planIds: state.includedPlanIds })}\``;

/**
 * Each line tells the reader what the work order's shipping waits for and the next step, and never
 * calls an implementation unfinished. The build line above it already says "ticket body", so these
 * lines name the build by its run instead.
 */
export const describeWorkOrderShipState = ({ name, state }: Params): string => {
	let line: string;

	switch (state.kind) {
		case WorkOrderShipStateKind.Shipped:
			line = `shipped as ${state.mergeCommit}`;
			break;
		case WorkOrderShipStateKind.ShipRequestMissing:
			line = 'no ship request is pending, so this work order stays open';
			break;
		case WorkOrderShipStateKind.ShipRequested:
			line = describeShipRequest({ name, state });
			break;
		case WorkOrderShipStateKind.PlanOneWaiting:
			line = `the work order ships once plan ${state.planId} is implemented`;
			break;
		case WorkOrderShipStateKind.PlanOneImplemented:
			line = `plan ${state.planId} is implemented, so the work order is ready to ship`;
			break;
		case WorkOrderShipStateKind.PlanOneExcluded:
			line = `plan ${state.planId} is excluded — ${state.reason} — so the work order has nothing to ship`;
			break;
		case WorkOrderShipStateKind.TicketBodyUnbuilt:
			line = 'the work order ships once a build of the ticket passes, or as work built by hand through `lightsout ship --hand-built`';
			break;
		case WorkOrderShipStateKind.TicketBodyBuilding:
			line = `a build of the ticket is recorded as in progress under run ${state.runId}`;
			break;
		case WorkOrderShipStateKind.TicketBodyFailed:
			line = `the build of the ticket under run ${state.runId} failed — resume it with \`lightsout resume --run ${state.runId}\`, or ship work built by hand through \`lightsout ship --hand-built\``;
			break;
		case WorkOrderShipStateKind.TicketBodyPassed:
			line = `the build of the ticket under run ${state.runId} passed, so the work order is ready to ship`;
			break;
		case WorkOrderShipStateKind.HandBuiltAuthorized:
			line = `${state.by} authorized shipping hand-built work at ${state.at}, so the work order is ready to ship`;
			break;
	}

	return line;
};
