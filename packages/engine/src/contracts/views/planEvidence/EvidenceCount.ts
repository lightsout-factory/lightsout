import { z } from 'zod';
import { EvidenceProvenance } from '#src/contracts/views/planEvidence/EvidenceProvenance.ts';

/** One figure of a plan's evidence summary, and where it came from. */
export const EvidenceCount = z.object({
	value: z.number(),
	provenance: z.enum(EvidenceProvenance),
});

export type EvidenceCount = z.infer<typeof EvidenceCount>;
