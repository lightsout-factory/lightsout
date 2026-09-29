import { z } from 'zod';
import { StandardsFinding } from '#src/contracts/standardsCheck/StandardsFinding.ts';

// Key order is load-bearing: people read this file in diffs.
export const StandardsSnapshot = z.object({
	at: z.string(),
	/** Repo-relative subpath the check covered ('.' for the whole repo). */
	path: z.string(),
	findings: z.array(StandardsFinding),
	notes: z.array(z.string()),
});

export type StandardsSnapshot = z.infer<typeof StandardsSnapshot>;
