import { readWorktreeRecord } from '#src/worktree/records/readWorktreeRecord.ts';

interface Params {
	/** Any checkout of the repository; the primary is resolved from it. */
	cwd: string;
	/** The branch the tree is on, when the run recorded one. */
	branch: string | undefined;
}

/**
 * Whether lightsout cut or adopted the tree on this branch. A branch nobody
 * records is judged like a person's own checkout — harmless, because after each
 * phase commits such a tree is clean.
 */
export const isLightsoutWorktree = async ({ cwd, branch }: Params): Promise<boolean> =>
	branch !== undefined && (await readWorktreeRecord({ cwd, branch })) !== undefined;
