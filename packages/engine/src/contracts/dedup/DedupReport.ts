import { z } from 'zod';
import { DedupFinding } from '#src/contracts/dedup/DedupFinding.ts';
import { ReviewedCollision } from '#src/contracts/dedup/ReviewedCollision.ts';

/**
 * An empty `findings` array is the clean result, but only when `complete` is
 * true: a failed judge keeps its siblings' findings and marks the pass
 * incomplete, so an unfinished scan never reads as "no duplication found".
 */
export const DedupReport = z.object({
	planName: z.string(),
	findings: z.array(DedupFinding).default([]),
	/** Every collision this pass ruled on, whatever the ruling — what a later `plan grade` subtracts before nudging. */
	reviewed: z.array(ReviewedCollision),
	/** False when a judge failed or hit the rate-limit wall; the findings above are real but partial. */
	complete: z.boolean().default(true),
	incompleteReason: z.string().optional(),
	reviewedAt: z.string(),
});

export type DedupReport = z.infer<typeof DedupReport>;
