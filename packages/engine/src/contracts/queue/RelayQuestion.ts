import { z } from 'zod';

/** Everything a reader needs to answer is in the file, so nothing has to be correlated with the queue's stdout. */
export const RelayQuestion = z.object({
	/** The ticket's human reference, e.g. 'LO-70'. */
	ticket: z.string(),
	/** The ticket title, so a reader has context without opening the tracker. */
	title: z.string(),
	question: z.string(),
	/** ISO timestamp the question was written, for judging how stale it is. */
	askedAt: z.string(),
});

export type RelayQuestion = z.infer<typeof RelayQuestion>;
