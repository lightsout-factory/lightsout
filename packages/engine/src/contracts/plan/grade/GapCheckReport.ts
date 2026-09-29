import { z } from 'zod';
import { PlanGap } from '#src/contracts/plan/grade/PlanGap.ts';

export const GapCheckReport = z.object({
	gaps: z.array(PlanGap).default([]),
});

export type GapCheckReport = z.infer<typeof GapCheckReport>;
