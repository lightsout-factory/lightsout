import { z } from 'zod';
import { TestChangeReview } from '#src/contracts/work/TestChangeReview.ts';

/** Written on every review, clean or not: a checkpoint that found nothing wrong is evidence too. */
export const TestReviewRecord = z.object({
	checkpoint: z.string().min(1),
	/** ISO timestamp. */
	at: z.string().min(1),
	/** After the engine's own rules were applied. */
	verdicts: TestChangeReview.shape.verdicts,
	/** Every rejection the checkpoint went red on. */
	rejections: z.array(z.string()).default([]),
});

export type TestReviewRecord = z.infer<typeof TestReviewRecord>;
