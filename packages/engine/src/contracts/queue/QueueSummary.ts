import { z } from 'zod';

/** What a finished queue printed, kept in its run folder so the outcome stays readable after the queue process has gone. */
export const QueueSummary = z.object({
	/** The finished board exactly as the queue printed it. */
	boardLines: z.array(z.string()),
	/** The per-ticket drain report exactly as the queue printed it. */
	reportLines: z.array(z.string()),
	/** The code the queue command exited with. */
	exitCode: z.number().int(),
	/** ISO time the drain finished. */
	finishedAt: z.string(),
});

export type QueueSummary = z.infer<typeof QueueSummary>;
