import { basename, dirname, join, resolve } from 'node:path';
import { readGitPrimaryCheckout } from '#src/common/git/readGitPrimaryCheckout.ts';

interface Params {
	/** Any checkout of the repository — a primary checkout, a linked worktree, or no repository at all. */
	cwd: string;
}

/**
 * A sibling of the repository, never inside it, so nothing walking up for a repository root finds the
 * wrong one. Computed from the primary checkout rather than `cwd`, or a command launched from a linked
 * worktree would cut a second root inside the first. Resolved absolute so a relative `--cwd` cannot
 * produce a path carrying `..`.
 */
export const resolveWorktreesRoot = async ({ cwd }: Params): Promise<string> => {
	const primary = await readGitPrimaryCheckout({ cwd });
	const repo = resolve(primary ?? cwd);

	return join(dirname(repo), `${basename(repo)}-worktrees`);
};
