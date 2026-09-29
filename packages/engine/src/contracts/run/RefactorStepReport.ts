import { z } from 'zod';
import { CleanupEndReason } from '#src/contracts/run/CleanupEndReason.ts';
import { StandardsFinding } from '#src/contracts/standardsCheck/StandardsFinding.ts';
import { WorkReport } from '#src/contracts/work/WorkReport.ts';

/**
 * `attempts` on the step record counts parks, resumes and rounds; only
 * `roundsUsed` counts executor invocations. The record is written before every
 * invocation so a park or crash leaves the round count on disk, which is why
 * `endReason` is absent while cleanup is still running.
 */
export const RefactorStepReport = z.object({
	/** Carried across a resume. */
	roundsUsed: z.number().int().nonnegative(),
	endReason: z.enum(CleanupEndReason).optional(),
	/** Qualifying blocking findings still standing when cleanup ended. */
	remaining: z.array(StandardsFinding),
	/** Findings on changed files the baseline already carried, unchanged or improved. */
	inherited: z.array(StandardsFinding),
	/** Findings whose provenance or worsening could not be established. */
	uncertain: z.array(StandardsFinding),
	failures: z.array(z.string()),
	/** The judgment reviewer's read before the first round. */
	initialReview: z.array(StandardsFinding),
	/** The judgment reviewer's read of the files cleanup changed. */
	finalReview: z.array(StandardsFinding),
	/** Rendered account of what cleanup left behind, or absent when it left nothing. */
	narration: z.string().optional(),
	lastReport: WorkReport.optional(),
});

export type RefactorStepReport = z.infer<typeof RefactorStepReport>;
