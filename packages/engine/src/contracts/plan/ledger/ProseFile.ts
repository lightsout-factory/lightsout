import { z } from 'zod';

/**
 * A file no test can state the behaviour of; forcing a ledger row for it
 * produces invented tests or dropped criteria, so it is exempted with a reason.
 */
export const ProseFile = z.object({
	/** Repo-relative path, also listed under one of the plan's file headings. */
	path: z.string().min(1),
	reason: z.string().min(1),
	line: z.number().int().positive(),
});

export type ProseFile = z.infer<typeof ProseFile>;
