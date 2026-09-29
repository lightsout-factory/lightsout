import { z } from 'zod';

export const CoverageTotal = z.object({
	scope: z.string(),
	statementsPct: z.number(),
	/** This scope's coverage command exit — the per-scope done signal; batching only targets failing scopes. */
	passed: z.boolean(),
});

export type CoverageTotal = z.infer<typeof CoverageTotal>;
