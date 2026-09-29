import { z } from 'zod';

/**
 * The `implement` command's own behaviour; `commands.implement`, a different
 * block, picks its harness. `.strict()` so a typo fails loudly rather than
 * silently leaving the default in force.
 */
export const ConfigImplement = z
	.object({
		/** Whether an implementation run builds in its own isolated git worktree rather than the checkout it was launched from. Default true. `--worktree` and `--no-worktree` override it for one run. */
		worktree: z.boolean().optional(),
		/** Implementation cleanup — the bounded, non-blocking tidying pass that ends a run's implementation. */
		refactor: z
			.object({
				/** How many cleanup executor rounds one run may spend at most. Default 2 (`defaultRefactorMaxRounds`). A whole count of invocations, so a fraction is refused; zero is refused too, because turning cleanup off is what the skip control does. */
				'max-rounds': z.number().int().positive().optional(),
			})
			.strict()
			.optional(),
	})
	.strict();

export type ConfigImplement = z.infer<typeof ConfigImplement>;
