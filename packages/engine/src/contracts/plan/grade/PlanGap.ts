import { z } from 'zod';
import { GapArea } from '#src/contracts/plan/grade/GapArea.ts';

export const PlanGap = z.object({
	area: z.enum(GapArea),
	gap: z.string(),
	decision: z.string(),
	options: z.array(z.string()).default([]),
});

export type PlanGap = z.infer<typeof PlanGap>;
