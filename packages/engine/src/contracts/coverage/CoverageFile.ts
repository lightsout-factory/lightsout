import { z } from 'zod';

export const CoverageFile = z.object({
	/** Repo-relative source path. */
	path: z.string(),
	/** Package dir name under packagesDir, or 'root'. */
	scope: z.string(),
	statementsPct: z.number(),
});

export type CoverageFile = z.infer<typeof CoverageFile>;
