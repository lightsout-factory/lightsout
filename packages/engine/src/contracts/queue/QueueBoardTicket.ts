import { z } from 'zod';
import { QueueLane } from '#src/contracts/queue/QueueLane.ts';

export const QueueBoardTicket = z.object({
	identifier: z.string(),
	title: z.string().optional(),
	url: z.string().optional(),
	lane: z.enum(QueueLane),
	worker: z.string().optional(),
	/**
	 * The label rather than the branch: plan addresses and runs folders are named by the
	 * label, and a branch carrying a template prefix names neither.
	 */
	workOrderName: z.string().optional(),
	branch: z.string().optional(),
	worktreePath: z.string().optional(),
	/** ISO time the ticket entered its current lane. */
	enteredAt: z.string(),
	/** ISO time its current build began. Set on a Building ticket and on a live question wait. */
	buildStartedAt: z.string().optional(),
	/** Why a ticket is Parked or Blocked, or a Shipped ticket's reconciliation failure. */
	reason: z.string().optional(),
	/** Set only while the ticket's live worker waits for a relayed answer. */
	question: z.string().optional(),
});

export type QueueBoardTicket = z.infer<typeof QueueBoardTicket>;
