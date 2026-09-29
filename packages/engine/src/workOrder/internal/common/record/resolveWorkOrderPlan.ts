import { planNumberOf } from '#src/common/planAddress/planNumberOf.ts';
import type { WorkOrderPlan } from '#src/contracts/workOrder/WorkOrderPlan.ts';
import type { WorkOrderState } from '#src/contracts/workOrder/WorkOrderState.ts';

interface Params {
	record: WorkOrderState;
	/** A full plan id, or its number alone — `2`, `02` and `002` all name plan 002. */
	token: string;
}

/** A bare number is unambiguous because no ticket ever reuses a plan number. */
export const resolveWorkOrderPlan = ({ record, token }: Params): WorkOrderPlan | { error: string } => {
	const numbered = /^\d{1,3}$/.test(token) ? record.plans.find((plan) => planNumberOf({ id: plan.id }) === Number(token)) : undefined;
	const plan = record.plans.find((candidate) => candidate.id === token) ?? numbered;
	const held = record.plans.length === 0 ? 'it holds no plans' : `it holds ${record.plans.map((candidate) => candidate.id).join(', ')}`;

	return plan ?? { error: `work order ${record.name} holds no plan '${token}' — ${held}` };
};
