import { z } from 'zod';

/**
 * Top-level because the queue and an isolated implementation run both prepare
 * worktrees; a key inside either block would read as belonging to that one
 * alone. `.strict()` so a typo fails loudly rather than silently leaving the
 * default in force.
 */
export const ConfigWorktree = z
	.object({
		/** Command run once in a fresh worktree before any agent, e.g. `pnpm install`. Absent means nothing runs. */
		setup: z.string().optional(),
	})
	.strict();

export type ConfigWorktree = z.infer<typeof ConfigWorktree>;
