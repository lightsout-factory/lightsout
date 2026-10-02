import { exitCli } from '#src/cli/common/utils/exitCli.ts';
import type { PlanWorktree } from '#src/cli/plan/internal/common/types/PlanWorktree.ts';
import { planWorkspaceDir } from '#src/plan/planWorkspaceDir.ts';

interface Params {
	/** The tree `planCommand` already resolved — resolving again here could answer differently. */
	worktree: PlanWorktree;
	/** The plan address. */
	name: string;
}

/**
 * Prints two lines: `plan folder: <absolute path>`, then the tree's path alone
 * on the last stdout line so a planning skill reads it back without parsing.
 * The plan folder is always under the primary checkout, whichever tree the
 * command runs in, so a skill authors the plan's files at that printed path
 * rather than at a path relative to the tree. A refusal never reaches here:
 * `planCommand` exits first.
 */
export const planWorkspaceCommand = async ({ worktree, name }: Params): Promise<void> => {
	console.log(`plan folder: ${await planWorkspaceDir({ cwd: worktree.cwd, name })}`);
	console.log(worktree.cwd);

	return exitCli({ code: 0 });
};
