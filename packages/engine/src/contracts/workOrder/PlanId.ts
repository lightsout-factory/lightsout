import { z } from 'zod';

/** `000` is refused because a work order numbers its plans from 001. */
const planIdShape = /^(?!000-)\d{3}-[a-z0-9]+(?:-[a-z0-9]+)*$/;

const maxSlugLength = 40;

/**
 * The number and slug are fixed for the life of the plan, because the id is
 * what a ship request, an exclusion and every published attachment name; the
 * display title is a separate, mutable field.
 */
export const PlanId = z
	.string()
	.regex(
		planIdShape,
		"a plan id is three digits from 001 to 999, a hyphen, and lowercase letter-and-digit words joined by single hyphens — for example '001-search-basics'",
	)
	.refine((id) => {
		const slugStart = 4;

		return id.length - slugStart <= maxSlugLength;
	}, `a plan id's slug is at most ${maxSlugLength} characters`);

export type PlanId = z.infer<typeof PlanId>;
