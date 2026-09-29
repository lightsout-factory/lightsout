import { z } from 'zod';

/**
 * One gate run at a time across every worktree of a repository on one machine:
 * several worktrees starting their suites at once makes suites that pass alone
 * die under load.
 *
 * No heartbeat field: reclaim reads the holder pid plus the live gate groups.
 */
export const GateLock = z.object({
	/** The holder's process. Dead means the engine is gone — half of what makes a leftover reclaimable. */
	pid: z.number().int(),
	runId: z.string(),
	worktree: z.string(),
	/** When the machine was taken, and so the only place a waiter can read the reservation's age from. */
	startedAt: z.string(),
	/**
	 * Gates are spawned detached, so a killed engine leaves these running:
	 * reclaiming on the dead pid alone would stack a second run on top of them.
	 */
	gateGroups: z.array(z.number().int()),
});

export type GateLock = z.infer<typeof GateLock>;
