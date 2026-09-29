import { z } from 'zod';

/** Persisted so a reader can say what a detached run is doing without a process to tail. */
export const ProgressRecord = z.object({
	/** ISO timestamp. */
	at: z.string(),
	message: z.string(),
});

export type ProgressRecord = z.infer<typeof ProgressRecord>;
