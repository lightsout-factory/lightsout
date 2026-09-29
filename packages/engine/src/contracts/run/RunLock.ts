import { z } from 'zod';

/**
 * One live run per repo, because two would fight over the same worktree. A lock
 * whose pid is dead is a crash leftover, stale rather than a conflict.
 */
export const RunLock = z.object({
	pid: z.number().int(),
	runId: z.string(),
	startedAt: z.string(),
});

export type RunLock = z.infer<typeof RunLock>;
