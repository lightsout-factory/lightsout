import { z } from 'zod';

/**
 * One entry rather than one per plan file, because the documentation checker
 * reads every plan file at once. The file list mirrors `GradeInputs.planFiles`
 * deliberately: whether this entry still stands is the same set comparison.
 */
export const GradeDocsCoverage = z.object({
	/** One entry per plan file the checker read, overview included, keyed by basename and sorted by it. */
	planFiles: z.array(z.object({ file: z.string(), designSha256: z.string() })).default([]),
	/** ISO time the check was recorded. */
	at: z.string(),
});

export type GradeDocsCoverage = z.infer<typeof GradeDocsCoverage>;
