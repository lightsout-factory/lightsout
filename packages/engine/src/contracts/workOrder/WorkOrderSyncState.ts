import { z } from 'zod';
import { PlanId } from '#src/contracts/workOrder/PlanId.ts';

const sha256Digest = z.string().regex(/^[a-f0-9]{64}$/, 'a hash is written as 64 lowercase hex characters');

/**
 * The base of the pull's three-way comparison, telling "only we moved", "only
 * the ticket moved" and "both moved" apart; without it two differing copies are
 * a divergence. Never published: it describes this machine's own history with
 * the ticket.
 */
export const WorkOrderSyncState = z
	.object({
		schemaVersion: z.literal(1),
		/** SHA-256 of the `serializeWorkOrderState` bytes last published or restored. Absent before the first sync. */
		recordSha256: sha256Digest.optional(),
		/** Per plan id, the SHA-256 of the plan's commit marker as this machine last published or restored it. */
		planMarkers: z.record(PlanId, sha256Digest),
	})
	.strict();

export type WorkOrderSyncState = z.infer<typeof WorkOrderSyncState>;
