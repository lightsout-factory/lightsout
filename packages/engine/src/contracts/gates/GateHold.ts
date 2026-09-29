import { z } from 'zod';

/**
 * Taken when a gate run stopped without ever getting the machine. One file per
 * ticket so a coordinator reconciling holds and a worker taking one never write
 * the same path and lose a hold.
 */
export const GateHold = z.object({
	takenAt: z.string(),
	runId: z.string(),
	worktreePath: z.string(),
	/** The coordination sentence the wait expiry produced, so it reads the same wherever it surfaces. */
	reason: z.string(),
	/**
	 * Whether the tracker label write has landed. Until it has, the hold is never
	 * read as released: the absence of a label nobody applied is no evidence.
	 */
	labelConfirmed: z.boolean(),
});

export type GateHold = z.infer<typeof GateHold>;
