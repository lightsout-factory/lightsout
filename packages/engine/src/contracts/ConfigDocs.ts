import { z } from 'zod';

/**
 * Declaring the block turns three things on at once: the plan writer's brief on
 * the surfaces, a required `## Documentation` statement in every implementable
 * plan file, and the `plan grade` checker that verifies it.
 *
 * `.min(1)` because an empty array would opt in to a check that can never fire,
 * and the entry is `.strict()` so a misspelled key fails loudly rather than
 * declaring a surface with no description.
 */
export const ConfigDocs = z
	.array(
		z
			.object({
				/** Repo-relative path of the document, e.g. `docs/configuration.md`. */
				path: z.string().min(1),
				/** One line saying what this document is responsible for. */
				covers: z.string().min(1),
			})
			.strict(),
	)
	.min(1);

export type ConfigDocs = z.infer<typeof ConfigDocs>;
