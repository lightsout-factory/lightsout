import { z } from 'zod';
import { PlanWeight } from '#src/contracts/plan/grade/PlanWeight.ts';

export const PhaseWeight = z.object({
	/** The plan file's basename, as `phasesChecked` spells it. */
	phase: z.string(),
	weight: z.enum(PlanWeight),
	/** Each threshold the file crossed, in plain words; empty for a light file. */
	reasons: z.array(z.string()).default([]),
});

export type PhaseWeight = z.infer<typeof PhaseWeight>;
