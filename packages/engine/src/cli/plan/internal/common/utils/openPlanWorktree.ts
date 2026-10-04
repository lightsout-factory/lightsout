import type { CommandContext } from '#src/cli/common/types/CommandContext.ts';
import { createProgressPrinter } from '#src/cli/internal/common/utils/createProgressPrinter.ts';
import type { PlanWorktree } from '#src/cli/plan/internal/common/types/PlanWorktree.ts';
import { resolvePlanWorktree } from '#src/cli/plan/internal/common/utils/resolvePlanWorktree.ts';
import { isSamePath } from '#src/common/isSamePath.ts';
import type { LightsoutConfig } from '#src/contracts/LightsoutConfig/LightsoutConfig.ts';

interface Params {
	/** The checkout the command was launched from. */
	cwd: string;
	config: LightsoutConfig | undefined;
	flags: CommandContext['flags'];
	/** A plan address. The branch is its work order's rather than the address itself. */
	name: string;
}

/**
 * The tree holds code work only: a plan folder lives in the main checkout
 * whichever checkout a plan command runs from, so nothing in the tree is lost
 * when it is removed.
 */
export const openPlanWorktree = async ({ cwd, config, flags, name }: Params): Promise<{ worktree: PlanWorktree } | { error: string }> => {
	const worktree = await resolvePlanWorktree({ cwd, config, flags, name, onProgress: createProgressPrinter() });

	if ('error' in worktree) {
		return { error: worktree.error };
	}

	// Only a session that moved says so; a line on every subcommand already
	// standing in the tree would bury the output it exists to print.
	if (worktree.isolated && !(await isSamePath({ path: cwd, otherPath: worktree.cwd }))) {
		console.log(`lightsout: workspace ${worktree.cwd}\n  branch: ${worktree.branch}`);
	}

	return { worktree };
};
