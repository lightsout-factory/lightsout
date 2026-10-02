import type { WorkOrderState } from '#src/contracts/workOrder/WorkOrderState.ts';
import { WorkOrderShipStateKind } from '#src/workOrder/common/constants/WorkOrderShipStateKind.ts';
import type { WorkOrderShipEligibility } from '#src/workOrder/common/types/WorkOrderShipEligibility.ts';
import type { WorkOrderShipRequestedState } from '#src/workOrder/common/types/WorkOrderShipRequestedState.ts';
import type { WorkOrderShipState } from '#src/workOrder/common/types/WorkOrderShipState.ts';
import { formatRequestShipCommand } from '#src/workOrder/common/utils/formatRequestShipCommand.ts';
import { readWorkOrderShipState } from '#src/workOrder/shipping/readWorkOrderShipState.ts';

interface Params {
	record: WorkOrderState;
}

/** Where a plan-less refusal points a person who built the ticket's work by hand. */
const handBuiltRemedy = 'to ship work built by hand instead, authorize it with `lightsout ship --hand-built`';

const describeRequestDrift = ({ state }: { state: WorkOrderShipRequestedState }) => {
	const clauses = [
		...(state.missingPlanIds.length === 0 ? [] : [`it does not name ${state.missingPlanIds.join(', ')}`]),
		...(state.stalePlanIds.length === 0 ? [] : [`it names ${state.stalePlanIds.join(', ')}, which the ticket no longer includes`]),
	];

	return clauses.join(', and ');
};

/** A multiple-plan ticket ships only on a request that still names exactly its included plans, every one of them implemented. */
const readShipRequestRefusal = ({ record, state }: { record: WorkOrderState; state: WorkOrderShipRequestedState }) => {
	const askAgain = `\`${formatRequestShipCommand({ name: record.name, planIds: state.includedPlanIds })}\``;
	let reason: string | undefined;

	if (state.missingPlanIds.length > 0 || state.stalePlanIds.length > 0) {
		reason = `the ship request on work order ${record.name} no longer names the plans it holds — ${describeRequestDrift({ state })} — so request shipping again with ${askAgain}`;
	} else if (state.waitingPlanId !== undefined) {
		reason = `the implementation of plan ${state.waitingPlanId} on work order ${record.name} has not finished, and every plan its ship request names is implemented before the ticket ships`;
	}

	return reason;
};

const readRefusal = ({ record, state }: { record: WorkOrderState; state: WorkOrderShipState }) => {
	let reason: string | undefined;

	switch (state.kind) {
		case WorkOrderShipStateKind.Shipped:
			reason = `work order ${record.name} already shipped as ${state.mergeCommit}, so its record no longer authorizes a merge`;
			break;
		case WorkOrderShipStateKind.ShipRequestMissing:
			reason = `work order ${record.name} is in multiple-plan mode and carries no ship request, so ask for one with \`${formatRequestShipCommand({ name: record.name, planIds: state.includedPlanIds })}\``;
			break;
		case WorkOrderShipStateKind.ShipRequested:
			reason = readShipRequestRefusal({ record, state });
			break;
		case WorkOrderShipStateKind.PlanOneWaiting:
			reason = `the implementation of plan ${state.planId} on work order ${record.name} has not finished, and a single-plan ticket ships once plan 001 is implemented`;
			break;
		case WorkOrderShipStateKind.PlanOneExcluded:
			reason = `plan ${state.planId} is excluded from work order ${record.name} — ${state.reason} — so a single-plan ticket has no implementation to ship`;
			break;
		case WorkOrderShipStateKind.TicketBodyUnbuilt:
			reason = `work order ${record.name} is in single-plan mode and holds no plan 001, and no build from the ticket body has passed on it — ${handBuiltRemedy}`;
			break;
		case WorkOrderShipStateKind.TicketBodyBuilding:
		case WorkOrderShipStateKind.TicketBodyFailed:
			reason = `the build from the ticket body of work order ${record.name} under run ${state.runId} has not passed, and a single-plan ticket holding no plan 001 ships once that build passed — ${handBuiltRemedy}`;
			break;
		case WorkOrderShipStateKind.PlanOneImplemented:
		case WorkOrderShipStateKind.TicketBodyPassed:
		case WorkOrderShipStateKind.HandBuiltAuthorized:
			reason = undefined;
			break;
	}

	return reason;
};

/**
 * Derived from `readWorkOrderShipState`, so the merge decision and the `show` line cannot drift
 * apart. A record that already says the ticket shipped is never eligible again. A plan's display
 * title takes no part, so a rename never withdraws an approval.
 */
export const readWorkOrderShipEligibility = ({ record }: Params): WorkOrderShipEligibility => {
	const reason = readRefusal({ record, state: readWorkOrderShipState({ record }) });

	return reason === undefined ? { eligible: true } : { eligible: false, reason };
};
