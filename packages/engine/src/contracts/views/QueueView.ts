import { z } from 'zod';
import { QueueBoardState } from '#src/contracts/queue/QueueBoardState.ts';
import { QueueBoardTicket } from '#src/contracts/queue/QueueBoardTicket.ts';
import { QueueLane } from '#src/contracts/queue/QueueLane.ts';

/**
 * A wrapper object rather than an optional drain, because a query's fetcher may
 * not resolve to `undefined`.
 */
export const QueueView = z.object({
	/** Absent when no queue run is on disk. */
	drain: z
		.object({
			runId: z.string(),
			state: z.enum(QueueBoardState),
			/** ISO time the state line shows. */
			at: z.string(),
			/** Only lanes holding tickets, in `QueueLane` key order, tickets in board order. */
			lanes: z.array(z.object({ lane: z.enum(QueueLane), tickets: z.array(QueueBoardTicket) })),
		})
		.optional(),
});

export type QueueView = z.infer<typeof QueueView>;
