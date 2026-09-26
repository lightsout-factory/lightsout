import { z } from 'zod';
import { RuleExampleKind } from '#src/contracts/views/RuleExampleKind.ts';

/**
 * What a rule's `rule.md` declares about its examples, under `example`.
 *
 * A repo names the file each side opens on — the one that shows the defect, or
 * its fix — because a tree of several files has no first file a reader should
 * start from by accident. A snippet names none: its one file is the example.
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
