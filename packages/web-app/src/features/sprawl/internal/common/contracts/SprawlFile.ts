import { z } from 'zod';

export const SprawlFile = z.object({
	/** Repo-relative path. */
	path: z.string(),
	lines: z.number(),
});

export type SprawlFile = z.infer<typeof SprawlFile>;
