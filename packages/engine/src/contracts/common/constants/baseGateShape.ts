import { z } from 'zod';

/**
 * The keys every gate block declares, whatever scope it gates: the two
 * required commands.
 *
 * Spread into a block's own `z.object({ … })` — each block still owns the gates
 * that are its alone (`generate`/`format` for the root block, the `{package}`
 * placeholder rule for the scoped one).
 */
export const baseGateShape = {
	check: z.string(),
	test: z.string(),
};
