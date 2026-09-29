import { z } from 'zod';
import { StandardsFinding } from '#src/contracts/standardsCheck/StandardsFinding.ts';

/**
 * Written the moment an agent review reports it, because a run that parks or
 * escalates never builds its batch report, and no code check can rediscover a
 * judgment finding.
 *
 * What was done about a finding is not here: the batch report's
 * `advisoryOutcomes` answers that, and two records of one answer can disagree.
 */
export const ReviewFindingRecord = StandardsFinding.extend({
	at: z.string(),
	runId: z.string(),
	/** The batch that was working when the review ran. */
	step: z.string(),
});

export type ReviewFindingRecord = z.infer<typeof ReviewFindingRecord>;
