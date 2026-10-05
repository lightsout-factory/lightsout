import { WorkOrderShipStateKind } from '#src/common/constants/WorkOrderShipStateKind.ts';
import { planNumberOf } from '#src/common/planAddress/planNumberOf.ts';
import type { WorkOrderShipState } from '#src/common/types/WorkOrderShipState.ts';
import { PlanProgress } from '#src/contracts/workOrder/PlanProgress.ts';
import { WorkOrderMode } from '#src/contracts/workOrder/WorkOrderMode.ts';
import type { WorkOrderState } from '#src/contracts/workOrder/WorkOrderState.ts';

interface Params {
	record: WorkOrderState;
}

/**
 * A passed build needs nothing authorized, so it wins over an authorization. An authorization
 * wins over a build that is implementing or failed: a build start withdraws it, so the two sit
 * together only when a person authorized over a paused or failed build.
 */
const readTicketBodyShipState = ({ record }: { record: WorkOrderState }) => {
	const build = record.ticketBodyBuild;
	const authorization = record.handBuiltShipAuthorization;
	let state: WorkOrderShipState;

	if (build?.progress === PlanProgress.Implemented) {
		state = { kind: WorkOrderShipStateKind.TicketBodyPassed, runId: build.runId };
	} else if (authorization !== undefined) {
		state = { kind: WorkOrderShipStateKind.HandBuiltAuthorized, by: authorization.by, at: authorization.at };
	} else if (build === undefined) {
		state = { kind: WorkOrderShipStateKind.TicketBodyUnbuilt };
	} else if (build.progress === PlanProgress.Failed) {
		state = { kind: WorkOrderShipStateKind.TicketBodyFailed, runId: build.runId };
	} else {
		state = { kind: WorkOrderShipStateKind.TicketBodyBuilding, runId: build.runId };
	}

	return state;
};

/** An excluded plan 001 still counts as held, as `isPlanlessWorkOrder` says, so it is read as excluded rather than as no plan 001. */
const readSinglePlanShipState = ({ record }: { record: WorkOrderState }) => {
	const first = record.plans.find((plan) => planNumberOf({ id: plan.id }) === 1);
	let state: WorkOrderShipState;

	if (first === undefined) {
		state = readTicketBodyShipState({ record });
	} else if (first.exclusion !== undefined) {
		state = { kind: WorkOrderShipStateKind.PlanOneExcluded, planId: first.id, reason: first.exclusion.reason };
	} else if (first.progress === PlanProgress.Implemented) {
		state = { kind: WorkOrderShipStateKind.PlanOneImplemented, planId: first.id };
	} else {
		state = { kind: WorkOrderShipStateKind.PlanOneWaiting, planId: first.id };
	}

	return state;
};

const readMultiplePlanShipState = ({ record }: { record: WorkOrderState }) => {
	const included = record.plans.filter((plan) => plan.exclusion === undefined);
	const includedPlanIds = included.map((plan) => plan.id);
	const request = record.shipRequest;
	let state: WorkOrderShipState;

	if (request === undefined) {
		state = { kind: WorkOrderShipStateKind.ShipRequestMissing, includedPlanIds };
	} else {
		const waiting = included.find((plan) => plan.progress !== PlanProgress.Implemented);

		state = {
			kind: WorkOrderShipStateKind.ShipRequested,
			planIds: request.planIds,
			includedPlanIds,
			missingPlanIds: includedPlanIds.filter((id) => !request.planIds.includes(id)),
			stalePlanIds: request.planIds.filter((id) => !includedPlanIds.includes(id)),
			...(waiting === undefined ? {} : { waitingPlanId: waiting.id }),
		};
	}

	return state;
};

/**
 * The one set of branches that reads a record's shipping: the merge decision, the `show` line, the
 * guard's shipped wording and the hand-built authorization all derive from it, so they cannot
 * drift apart. A record that says it shipped is shipped whatever else it still carries.
 */
export const readWorkOrderShipState = ({ record }: Params): WorkOrderShipState => {
	let state: WorkOrderShipState;

	if (record.shipped !== undefined) {
		state = { kind: WorkOrderShipStateKind.Shipped, mergeCommit: record.shipped.mergeCommit };
	} else if (record.mode === WorkOrderMode.SinglePlan) {
		state = readSinglePlanShipState({ record });
	} else {
		state = readMultiplePlanShipState({ record });
	}

	return state;
};
