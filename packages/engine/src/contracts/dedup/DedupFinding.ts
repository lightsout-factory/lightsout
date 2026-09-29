import { z } from 'zod';
import { DedupVerdict } from '#src/contracts/dedup/DedupVerdict.ts';

/** A detected collision joined with the judge's verdict by `plannedSymbol`; only verdicts with `isDuplicate === true` become findings. */
export const DedupFinding = DedupVerdict.omit({ isDuplicate: true }).extend({
	plannedPath: z.string(),
	/** Basename of the plan file this duplication was planned in — the file the skill edits to resolve it. */
	phase: z.string(),
	collidesWith: z.array(z.object({ name: z.string(), path: z.string() })).default([]),
});

export type DedupFinding = z.infer<typeof DedupFinding>;
