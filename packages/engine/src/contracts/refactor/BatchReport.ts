import { z } from 'zod';
import { BatchOutcome } from '#src/contracts/refactor/BatchOutcome.ts';
import { AdvisoryOutcome } from '#src/contracts/standardsCheck/AdvisoryOutcome.ts';

export const BatchReport = z.object({
	outcome: z.enum(BatchOutcome),
	remainingSiteKeys: z.array(z.string()),
	/** Why findings were declined, from the agent's friction entries. */
	rationale: z.array(z.string()),
	/** Accumulated across the batch's invocations. Absent means the agent reported none. */
	advisoryOutcomes: z.array(AdvisoryOutcome).optional(),
});

export type BatchReport = z.infer<typeof BatchReport>;
