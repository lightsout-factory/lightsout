import { basename } from 'node:path';
import { parsePlanAddress } from '#src/common/planAddress/parsePlanAddress/parsePlanAddress.ts';
import type { WorkOrderRunTerms } from '#src/common/types/WorkOrderRunTerms.ts';
import { PlanProgress } from '#src/contracts/workOrder/PlanProgress.ts';
import { WorkOrderMode } from '#src/contracts/workOrder/WorkOrderMode.ts';
import { findPlanImplementationBlocker } from '#src/workOrder/implementRun/common/findPlanImplementationBlocker.ts';
import { isWholePlanRun } from '#src/workOrder/implementRun/common/isWholePlanRun.ts';
import { readWorkOrderState } from '#src/workOrder/readWorkOrderState.ts';
import { readWorkOrderShipEligibility } from '#src/workOrder/shipping/readWorkOrderShipEligibility/readWorkOrderShipEligibility.ts';

interface Params {
	/** Any checkout of the repository; the record is read from its primary checkout. */
	cwd: string;
	/** Undefined for a plan outside the plans directory. */
	name: string | undefined;
	/** The plan.md, overview.md, or one phase file. Undefined for a build from the ticket body. */
	planPath: string | undefined;
}

/**
 * Asked before a run and again after it with the same name, so the manifest's
 * `willShip` stamp and the chain that happens agree by construction.
 *
 * A `shipRequest` means the ticket's record decides this run's shipping; its
 * absence leaves it to `--ship` and `ship.after-implement`. Only the LOCAL
 * record is read, because the authoritative check is the ship guard's, which
 * pulls first.
 */
export const readWorkOrderRunTerms = async ({ cwd, name, planPath }: Params): Promise<WorkOrderRunTerms> => {
	if (name === undefined) {
		return {};
	}

	const address = parsePlanAddress({ name });

	if (address === undefined) {
		return {};
	}

	const read = await readWorkOrderState({ cwd, name: address.workOrderName });

	if ('error' in read) {
		return { refusal: read.error, shipRequest: { blocker: read.error } };
	}

	const { record } = read;

	if (record === undefined) {
		return {};
	}

	const { planId } = address;
	const refusal = findPlanImplementationBlocker({ record, planId });
	let shipRequest: WorkOrderRunTerms['shipRequest'];

	if (planPath !== undefined && !(await isWholePlanRun({ cwd, name, planPath }))) {
		// A run of one phase file never records the plan implemented, so it can
		// never satisfy a ship request, in any mode.
		shipRequest = {
			blocker: `this run covers ${basename(planPath)} alone, and the implementation of plan ${planId} on work order ${record.name} has not finished until the whole plan runs`,
		};
	} else if (record.mode === WorkOrderMode.MultiplePlan) {
		// Eligibility is asked of the record as this run's pass would leave it,
		// rather than restating the rules here.
		const eligibility = readWorkOrderShipEligibility({
			record: { ...record, plans: record.plans.map((plan) => (plan.id === planId ? { ...plan, progress: PlanProgress.Implemented } : plan)) },
		});

		shipRequest = { blocker: eligibility.eligible ? undefined : eligibility.reason };
	}

	return { refusal, shipRequest };
};
