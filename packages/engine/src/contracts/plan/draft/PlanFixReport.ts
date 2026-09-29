import { z } from 'zod';
import { PlanFixStatus } from '#src/contracts/plan/draft/PlanFixStatus.ts';

export const PlanFixReport = z.object({
	status: z.enum(PlanFixStatus),
	filesEdited: z.array(z.string()).default([]),
	discrepancies: z.array(z.string()).default([]),
});

export type PlanFixReport = z.infer<typeof PlanFixReport>;
