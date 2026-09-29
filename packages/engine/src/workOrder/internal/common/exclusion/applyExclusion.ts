import { WorkOrderEventKind } from '#src/contracts/workOrder/WorkOrderEventKind.ts';
import type { WorkOrderPlan } from '#src/contracts/workOrder/WorkOrderPlan.ts';
import type { WorkOrderState } from '#src/contracts/workOrder/WorkOrderState.ts';
import { appendWorkOrderEvent } from '#src/workOrder/internal/common/record/appendWorkOrderEvent.ts';
import { recordShipRequestWithdrawal } from '#src/workOrder/internal/common/record/recordShipRequestWithdrawal.ts';

interface Params {
	record: WorkOrderState;
	target: WorkOrderPlan;
	/** The record's only account of the decision. */
	reason: string;
	implementationRemoved: boolean;
	/** Set only for a plan whose implementation started. */
	verifiedCommit: string | undefined;
	at: string;
}

export const applyExclusion = ({
	record,
	target,
	reason,
	implementationRemoved,
	verifiedCommit,
	at,
}: Params): { record: WorkOrderState; withdrew: boolean } => {
	const amending = target.exclusion !== undefined;
	const exclusion =
		target.exclusion === undefined
			? { at, reason, implementationRemoved, ...(verifiedCommit === undefined ? {} : { verifiedCommit }) }
			: { ...target.exclusion, implementationRemoved: true, verifiedCommit };
	const excluded = appendWorkOrderEvent({
		record: { ...record, plans: record.plans.map((candidate) => (candidate.id === target.id ? { ...candidate, exclusion } : candidate)) },
		kind: WorkOrderEventKind.PlanExcluded,
		detail: amending
			? `plan ${target.id}'s implementation was recorded as removed from work order ${record.name}, verified at ${verifiedCommit}`
			: `plan ${target.id} was excluded from work order ${record.name}: ${reason}`,
		at,
	});
	const named = record.shipRequest?.planIds.includes(target.id) === true;

	return {
		record: named
			? recordShipRequestWithdrawal({
					record: excluded,
					detail: `plan ${target.id} was excluded — ${reason} — so the ship request naming it no longer describes the ticket's work`,
					at,
				})
			: excluded,
		withdrew: named,
	};
};
