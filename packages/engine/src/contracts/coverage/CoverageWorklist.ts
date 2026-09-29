import { z } from 'zod';
import { CoverageFile } from '#src/contracts/coverage/CoverageFile.ts';
import { CoverageTotal } from '#src/contracts/coverage/CoverageTotal.ts';

/**
 * Frozen at run start as the final report's `before` side. Never the source of
 * later batches: writing tests changes these numbers, so every round measures again.
 */
export const CoverageWorklist = z.object({
	at: z.string(),
	totals: z.array(CoverageTotal),
	/** Worst-first (statements pct ascending, ties by path). */
	files: z.array(CoverageFile),
});

export type CoverageWorklist = z.infer<typeof CoverageWorklist>;
