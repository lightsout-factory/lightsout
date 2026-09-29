import { z } from 'zod';

/**
 * `lens` is a plain string rather than the `GapCheckLens` enum: it is only ever
 * compared for equality, so a memory written under a brief the enum later drops
 * must still parse rather than refusing the whole file.
 */
export const GradeReadCoverage = z.object({
	/** The plan file's basename — the same label `GradedGap.phase` and `GradeReport.phasesChecked` carry. */
	file: z.string(),
	/** The reader brief this entry speaks for, as `GapCheckLens` spells it. */
	lens: z.string(),
	/** sha256 of the plan file's DESIGN text — its content with every engine-generated region removed. */
	designSha256: z.string(),
	/** The phase-graph neighbours this file had when the entry was written, sorted. Empty means the graph joined it to nothing, never that nobody looked. */
	neighbours: z.array(z.string()).default([]),
	/** ISO time the reading was recorded. */
	at: z.string(),
});

export type GradeReadCoverage = z.infer<typeof GradeReadCoverage>;
