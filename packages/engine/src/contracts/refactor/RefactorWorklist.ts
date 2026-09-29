import { z } from 'zod';
import { RefactorBatch } from '#src/contracts/refactor/RefactorBatch.ts';

/** Computed once at run start and never recomputed, so resume is deterministic. */
export const RefactorWorklist = z.object({
	at: z.string(),
	/** Standards-check scope subpath, '.' for the whole repo. */
	path: z.string(),
	/** Whether baselined findings were included. */
	all: z.boolean(),
	batches: z.array(RefactorBatch),
});

export type RefactorWorklist = z.infer<typeof RefactorWorklist>;
