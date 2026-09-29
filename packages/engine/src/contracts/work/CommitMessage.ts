import { z } from 'zod';

/**
 * The shape lives here rather than only in the role prompt because this is what
 * the engine can enforce: an answer it cannot turn into a subject is rejected at
 * the boundary and never reaches a commit.
 */
export const CommitMessage = z.object({
	summary: z
		.string()
		.min(1, 'a commit summary says what the change does in at least one character')
		.max(64, 'a commit summary is at most 64 characters')
		.regex(/^[^\r\n]*$/u, 'a commit summary is one line, with no line break'),
	body: z.string().max(1200, 'a commit body is at most 1200 characters').optional(),
});

export type CommitMessage = z.infer<typeof CommitMessage>;
