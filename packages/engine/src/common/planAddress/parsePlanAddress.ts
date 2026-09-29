import type { PlanAddress } from '#src/common/types/PlanAddress.ts';
import { PlanId } from '#src/contracts/workOrder/PlanId.ts';

interface Params {
	/** Whatever a command was handed as a `--name`: a plan address, or a work order's name. */
	name: string;
}

/**
 * The one reader of the address shape, paired with `formatPlanAddress`, so
 * nothing else splits a name of its own.
 *
 * Undefined is not a failure: a work order's name is a valid answer wherever a
 * whole ticket is meant, and each caller decides. A first segment that is
 * empty, `.` or `..` is refused because it would resolve outside the plans directory.
 */
export const parsePlanAddress = ({ name }: Params): PlanAddress | undefined => {
	const [workOrderName, planId, ...beyond] = name.split('/');
	const addressed =
		beyond.length === 0 &&
		workOrderName !== undefined &&
		planId !== undefined &&
		workOrderName !== '' &&
		workOrderName !== '.' &&
		workOrderName !== '..' &&
		PlanId.safeParse(planId).success;

	return addressed ? { workOrderName, planId } : undefined;
};
