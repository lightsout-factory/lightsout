import { z } from 'zod';
import { RunStatus } from '#src/contracts/run/RunStatus.ts';
import { ShippingStepId } from '#src/contracts/ship/ShippingStepId.ts';

/** Carries no attempts count: the record's own `attempt` does. */
const shippingStepRecord = z.object({
	id: z.enum(ShippingStepId),
	status: z.enum(RunStatus),
	/** ISO time the step last started. */
	startedAt: z.string().optional(),
	durationMs: z.number().optional(),
});

/**
 * Written to `ship-progress.json` in the ticket folder under the primary
 * checkout, beside the ship result: the result is read once the ship has ended,
 * this while it is still going.
 */
export const ShippingProgress = z.object({
	branch: z.string(),
	/** The current attempt, 1-based. */
	attempt: z.number().int().positive(),
	maxAttempts: z.number().int().positive(),
	pid: z.number().int(),
	/** ISO time the ship's first attempt began. */
	startedAt: z.string(),
	/** ISO time of the last write. */
	updatedAt: z.string(),
	/** ISO time the ship sequence finished. Set only once it has. */
	endedAt: z.string().optional(),
	lastProgress: z.string().optional(),
	steps: z.array(shippingStepRecord),
});

export type ShippingProgress = z.infer<typeof ShippingProgress>;
