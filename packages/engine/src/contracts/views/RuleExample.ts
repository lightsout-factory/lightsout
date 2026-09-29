import { z } from 'zod';
import { RuleExampleKind } from '#src/contracts/views/RuleExampleKind.ts';

/**
 * A repo names the file each side opens on because a tree of several files has
 * no first file a reader should start from by accident.
 */
export const RuleExample = z.discriminatedUnion('kind', [
	z.object({ kind: z.literal(RuleExampleKind.Snippet) }).strict(),
	z
		.object({
			kind: z.literal(RuleExampleKind.Repo),
			/** The path, relative to each side's root, that side opens on. */
			focus: z.object({ fail: z.string().min(1), pass: z.string().min(1) }).strict(),
		})
		.strict(),
]);

export type RuleExample = z.infer<typeof RuleExample>;
