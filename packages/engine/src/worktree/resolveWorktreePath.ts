import { join } from 'node:path';
import { resolveWorkOrderNameForBranch } from '#src/common/workspace/resolveWorkOrderNameForBranch.ts';
import { resolveWorktreesRoot } from '#src/worktree/resolveWorktreesRoot.ts';

interface Params {
	/** Any checkout of the repository; the primary is resolved from it. */
	cwd: string;
	branch: string;
}

/**
 * Falling back to the branch is safe: a branch carrying a slash only comes from
 * `queue.branch-template`, and a templated branch always belongs to a work order. A caller holding
 * many branches should resolve the root once with `resolveWorktreesRoot`, since this spawns git per call.
 */
export const resolveWorktreePath = async ({ cwd, branch }: Params): Promise<string> =>
	join(await resolveWorktreesRoot({ cwd }), await resolveWorkOrderNameForBranch({ cwd, branch }));
