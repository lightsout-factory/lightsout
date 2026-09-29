import { z } from 'zod';
import { DedupVerdict } from '#src/contracts/dedup/DedupVerdict.ts';

/** An empty `verdicts` array is a legitimate "nothing is a real duplicate" result. */
export const DedupJudgment = z.object({
	verdicts: z.array(DedupVerdict).default([]),
});

export type DedupJudgment = z.infer<typeof DedupJudgment>;
