import { z } from 'zod';

/**
 * The one process answering for a run family, recorded at the family root and
 * kept out of the frequently rewritten manifest. The process form names the
 * engine working on the run, with its start time when `ps` could read it so a
 * reused pid is not mistaken for it. The pointer form sits on a queue worker's
 * run: the worker lives inside the queue process, so the queue run named here
 * holds the owner record that answers for it.
 */
export const RunOwner = z.union([
	z.object({
		pid: z.number().int(),
		processStartTime: z.string().optional(),
		recordedAt: z.string(),
	}),
	z.object({
		queueRunId: z.string(),
	}),
]);

export type RunOwner = z.infer<typeof RunOwner>;
