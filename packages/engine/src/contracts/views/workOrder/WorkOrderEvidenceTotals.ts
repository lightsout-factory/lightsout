import { z } from 'zod';
import { EvidenceHeadline } from '#src/contracts/views/planEvidence/EvidenceHeadline.ts';

/** The work order page's headline, totalled across the plans that have evidence. */
export const WorkOrderEvidenceTotals = z.object({
	headline: EvidenceHeadline,
	/** Plans whose `PlanEvidence` has a `startedAt` or any section. */
	plansCovered: z.number(),
	/** The work order's plans that carry no exclusion. */
	plansCounted: z.number(),
	/** Each covered plan's evidence problems, prefixed with its plan id. */
	problems: z.array(z.string()).default([]),
});

export type WorkOrderEvidenceTotals = z.infer<typeof WorkOrderEvidenceTotals>;
