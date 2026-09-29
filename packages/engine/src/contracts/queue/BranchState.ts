import { z } from 'zod';
import { BranchPhase } from '#src/contracts/queue/BranchPhase.ts';

/**
 * Lives in the primary checkout so it outlives the worktree the ship step removes, and is
 * never deleted: a merged record is what keeps a finished branch away from the next worker.
 */
export const BranchState = z.object({
	branch: z.string(),
	phase: z.enum(BranchPhase),
	/** ISO timestamp of the write that last changed the phase. */
	updatedAt: z.string(),
});

export type BranchState = z.infer<typeof BranchState>;
