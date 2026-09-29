import { z } from 'zod';
import { DecisionSource } from '#src/contracts/plan/decisions/DecisionSource.ts';

/** An `assumption` row is a choice made without human confirmation, flagged so the gap-check can surface it. */
export const DecisionRow = z.object({
	source: z.enum(DecisionSource),
	question: z.string(),
	options: z.string(),
	choice: z.string(),
	rationale: z.string(),
	assumption: z.boolean().default(false),
	/**
	 * The phase-file basenames the decision concerns. Absent when it concerns the
	 * whole plan or its reach is not established. The names are checked when
	 * grading chooses its scope, not when the record is read.
	 */
	phases: z.array(z.string()).min(1).optional(),
});

export type DecisionRow = z.infer<typeof DecisionRow>;
