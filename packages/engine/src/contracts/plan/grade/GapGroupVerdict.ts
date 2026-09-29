import { z } from 'zod';
import { GapVerdict } from '#src/contracts/plan/grade/GapVerdict.ts';

/**
 * `answerAt` is replaced by `answers` rather than kept beside it: a single
 * citation and a per-file citation list are two spellings of one claim.
 *
 * `covers` and `answers` default to empty rather than being required, so a
 * malformed payload is refused by `accountBatchVerdicts` with a reason a human
 * reads, rather than retried as a parse failure that explains nothing.
 */
export const GapGroupVerdict = GapVerdict.omit({ answerAt: true }).extend({
	/** The engine-assigned identifiers (`o1`, `o2`, …) of every observation this ruling settles. Two or more is a claim that they are one defect. */
	covers: z.array(z.string()).default([]),
	/** Two or more covered: the one violated requirement or contradiction every covered observation is. */
	sharedDefect: z.string().optional(),
	/** `already-answered`: one citation per plan file the covered observations span, each quoted from that file's own text or naming a path on disk. */
	answers: z.array(z.object({ phase: z.string(), answerAt: z.string() })).default([]),
});

export type GapGroupVerdict = z.infer<typeof GapGroupVerdict>;
