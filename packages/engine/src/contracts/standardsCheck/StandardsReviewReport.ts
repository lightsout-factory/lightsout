import { z } from 'zod';

// Site keys are not asked for: the engine derives them, so a reviewed finding is
// addressable by the same key everything else uses.
export const StandardsReviewReport = z.object({
	findings: z.array(
		z.object({
			/** A judgment rule's id — validated against the loaded packages after parsing. */
			rule: z.string(),
			files: z.array(z.object({ path: z.string(), startLine: z.number().optional(), endLine: z.number().optional() })),
			detail: z.string(),
			guidance: z.string().optional(),
		}),
	),
});

export type StandardsReviewReport = z.infer<typeof StandardsReviewReport>;
