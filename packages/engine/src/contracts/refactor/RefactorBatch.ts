import { z } from 'zod';
import { StandardsFinding } from '#src/contracts/standardsCheck/StandardsFinding.ts';

/** One kind of finding in one area of the repo: a single agent job. */
export const RefactorBatch = z.object({
	/** Manifest step id: `batch-NN:<rule>:<folder>` — the rule is one of the standards-check rule ids, not a check function. */
	id: z.string(),
	rule: z.string(),
	/** Grouping folder: `<packagesDir>/<package>` when under it, else the top path segment, else '(root)'. */
	folder: z.string(),
	blocking: z.array(StandardsFinding),
	/** Advisories whose files overlap this batch: context, never blocking. */
	advisories: z.array(StandardsFinding),
});

export type RefactorBatch = z.infer<typeof RefactorBatch>;
