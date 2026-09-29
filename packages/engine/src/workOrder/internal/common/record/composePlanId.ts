import { z } from 'zod';
import { PlanId } from '#src/contracts/workOrder/PlanId.ts';

interface Params {
	/** The plan's number, which becomes the id's three zero-padded digits. */
	number: number;
	/** The plan slug, fixed for the life of the plan: lowercase letter-and-digit words joined by single hyphens. */
	slug: string;
}

export const composePlanId = ({ number, slug }: Params): { id: string } | { error: string } => {
	const parsed = PlanId.safeParse(`${String(number).padStart(3, '0')}-${slug}`);

	return parsed.success ? { id: parsed.data } : { error: `'${slug}' cannot be a plan slug: ${z.prettifyError(parsed.error)}` };
};
