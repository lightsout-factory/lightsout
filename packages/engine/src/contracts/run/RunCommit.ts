import { z } from 'zod';

/** Strict, so a field a newer engine wrote fails the parse rather than being stripped and written back missing. */
export const RunCommit = z
	.object({
		sha: z.string(),
		subject: z.string(),
		/** A phase's own child run id, which is why a coordinator's list can name several. */
		runId: z.string(),
	})
	.strict();

export type RunCommit = z.infer<typeof RunCommit>;
