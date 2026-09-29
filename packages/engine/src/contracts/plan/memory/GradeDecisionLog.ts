import { z } from 'zod';

/**
 * Lets the scope comparison tell a change to the generated `## Decision Log`
 * apart from a change to the overview's own design text.
 *
 * Every plan carries the rows, a single plan included: a rule recorded on a plan
 * with no overview has no generated section in any hash, so without the rows
 * the exact-input short-circuit would hand back a grade taken without it.
 */
export const GradeDecisionLog = z.object({
	/**
	 * sha256 of the overview's shared design text: its content with every
	 * engine-generated region and every span credited to one phase removed.
	 * Absent means there is no shared overview text to compare.
	 */
	overviewDesign: z.string().optional(),
	/** One entry per merged decision row, in record order, brainstorm rows first. */
	rows: z.array(
		z.object({
			/** sha256 of the canonical JSON of the whole row. */
			sha256: z.string(),
			/** sha256 of the row's question — what links a revision to the row it supersedes. */
			questionSha256: z.string(),
			/** The phase files the row is taken to reach, as it declares them; absent when it reaches the whole plan. */
			phases: z.array(z.string()).min(1).optional(),
		}),
	),
});

export type GradeDecisionLog = z.infer<typeof GradeDecisionLog>;
