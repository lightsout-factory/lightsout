import { z } from 'zod';
import { PlanDraftStatus } from '#src/contracts/plan/draft/PlanDraftStatus.ts';
import { PlanVariant } from '#src/contracts/plan/draft/PlanVariant.ts';

export const PlanDraftReport = z.object({
	status: z.enum(PlanDraftStatus),
	filesWritten: z
		.array(
			z.object({
				path: z.string(),
				variant: z.enum(PlanVariant),
				/** The scope this file covers (a phase slug, or 'single'). */
				scope: z.string(),
			}),
		)
		.default([]),
	decisionsApplied: z.number(),
	assumptions: z.array(z.string()).default([]),
	discrepancies: z.array(z.string()).default([]),
});

export type PlanDraftReport = z.infer<typeof PlanDraftReport>;
