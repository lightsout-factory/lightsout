import { z } from 'zod';
import { DedupResolution } from '#src/contracts/dedup/DedupResolution.ts';

/** `suggestedLocation` and `migrateCallers` belong to an `extract` recommendation. */
export const DedupVerdict = z.object({
	plannedSymbol: z.string(),
	isDuplicate: z.boolean(),
	recommendation: z.enum(DedupResolution),
	rationale: z.string(),
	suggestedLocation: z.string().optional(),
	migrateCallers: z.array(z.string()).default([]),
});

export type DedupVerdict = z.infer<typeof DedupVerdict>;
