import { z } from 'zod';
import { DecisionRow } from '#src/contracts/plan/decisions/DecisionRow.ts';
import { DecisionSource } from '#src/contracts/plan/decisions/DecisionSource.ts';

/**
 * `source` is pinned to `Brainstorm` because the origin label is what keeps
 * these rows distinguishable from the plan's own interview in the Decision Log,
 * so a mislabelled row is a hard read failure rather than a silent relabel.
 */
export const BrainstormDecisions = z.object({
	planName: z.string(),
	decisions: z.array(DecisionRow.extend({ source: z.literal(DecisionSource.Brainstorm) })).default([]),
});

export type BrainstormDecisions = z.infer<typeof BrainstormDecisions>;
