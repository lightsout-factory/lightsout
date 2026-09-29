import { z } from 'zod';
import { SupervisorDecision } from '#src/contracts/work/SupervisorDecision.ts';

export const SupervisorVerdict = z.object({
	decision: z.enum(SupervisorDecision),
	/** Root-cause analysis of why the step keeps failing. */
	diagnosis: z.string(),
	/** Concrete instructions injected into the retry invocation. Required when decision is retry. */
	guidance: z.string().optional(),
});

export type SupervisorVerdict = z.infer<typeof SupervisorVerdict>;
