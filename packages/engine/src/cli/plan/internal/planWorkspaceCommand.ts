import { exitCli } from '#src/cli/common/utils/exitCli.ts';
import type { PlanWorktree } from '#src/cli/plan/internal/common/types/PlanWorktree.ts';

interface Params {
	/** The tree `planCommand` already resolved — resolving again here could answer differently. */
	worktree: PlanWorktree;
}

/**
 * The path is written alone on the last stdout line so a planning skill reads it
 * back without parsing. A refusal never reaches here: `planCommand` exits first.
 */
export const planWorkspaceCommand = async ({ worktree }: Params): Promise<void> => {
	console.log(worktree.cwd);

	return exitCli({ code: 0 });
};
