import { z } from 'zod';

/**
 * `findings` holds only confirmed duplications, so without this a collision
 * ruled distinct is indistinguishable from one nobody looked at.
 *
 * Identity is the triple, not the symbol alone: the same name planned at two
 * paths, or in two phases, is two separate rulings.
 */
export const ReviewedCollision = z.object({
	plannedSymbol: z.string(),
	/** Repo-relative Files-to-Create path the symbol would be created at. */
	plannedPath: z.string(),
	/** Basename of the plan file whose `## Files to Create` declared it. */
	phase: z.string(),
});

export type ReviewedCollision = z.infer<typeof ReviewedCollision>;
