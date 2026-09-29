import { z } from 'zod';

/** One row of a plan's `## Acceptance Tests` ledger. */
export const LedgerRow = z.object({
	/** The acceptance criterion in one line. */
	criterion: z.string().min(1),
	/** Repo-relative path of the test file that states it. May already exist. */
	testFile: z.string().min(1),
	/** The exact test name the writer must use. */
	testName: z.string().min(1),
	/** The gate key from `gates` that runs this test; `test` when the row leaves it blank. */
	gate: z.string().min(1),
	/** 1-based line of the row in its plan file, for findings. */
	line: z.number().int().positive(),
});

export type LedgerRow = z.infer<typeof LedgerRow>;
