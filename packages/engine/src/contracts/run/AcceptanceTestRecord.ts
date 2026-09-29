import { z } from 'zod';

/**
 * Rewritten by an approved disposition, so a moved, renamed or replaced test is
 * proven under the name it now carries rather than the one the plan wrote down.
 */
export const AcceptanceTestRecord = z.object({
	criterion: z.string().min(1),
	/** Repo-relative. */
	testFile: z.string().min(1),
	testName: z.string().min(1),
	/** The gate key whose execution has to show this test passing. */
	gate: z.string().min(1),
});

export type AcceptanceTestRecord = z.infer<typeof AcceptanceTestRecord>;
