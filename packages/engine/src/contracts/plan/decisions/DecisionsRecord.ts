import { z } from 'zod';
import { DecisionRow } from '#src/contracts/plan/decisions/DecisionRow.ts';

/** The session-authored `decisions.json`. */
export const DecisionsRecord = z.object({
	planName: z.string(),
	decisions: z.array(DecisionRow).default([]),
});

export type DecisionsRecord = z.infer<typeof DecisionsRecord>;
