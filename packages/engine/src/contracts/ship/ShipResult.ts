import { z } from 'zod';
import { ShipBlockReason } from '#src/contracts/ship/ShipBlockReason.ts';
import { ShipStatus } from '#src/contracts/ship/ShipStatus.ts';

/**
 * Written on every exit path, blocked included, so a tracker skill can tell
 * "ship never ran" from "ship ran and stopped".
 *
 * Every field beyond `status` is optional so one schema parses both outcomes. A
 * shipped result always carries `ticketRef`, `prNumber`, `prUrl`, `prTitle`,
 * `mergeCommit` and `mergedAt`.
 */
export const ShipResult = z.object({
	status: z.enum(ShipStatus),
	/** Branch shipped, as git names it. Absent only when git itself was unreadable before a branch name was known. */
	branch: z.string().optional(),
	/** The `ticket` capture group of the configured pattern, e.g. 'lo-60'. Absent when the branch did not match. */
	ticketRef: z.string().optional(),
	prNumber: z.number().optional(),
	prUrl: z.string().optional(),
	prTitle: z.string().optional(),
	mergeCommit: z.string().optional(),
	/** ISO timestamp of the merge. */
	mergedAt: z.string().optional(),
	/** Present exactly when status is 'blocked'. */
	reason: z.enum(ShipBlockReason).optional(),
	/**
	 * One sentence naming what stopped it, followed by a colon and the stopping
	 * command's output when there was one — capped, since a tracker skill quotes it.
	 */
	detail: z.string().optional(),
	/** Named checks that finished red or never finished — filled for 'checks-failed' and 'checks-timed-out'. */
	failingChecks: z.array(z.string()).default([]),
});

export type ShipResult = z.infer<typeof ShipResult>;
