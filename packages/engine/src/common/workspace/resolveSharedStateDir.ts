import { join } from 'node:path';
import { readGitPrimaryCheckout } from '#src/common/git/readGitPrimaryCheckout.ts';
import { isSamePath } from '#src/common/paths/isSamePath.ts';

interface Params {
	/** The directory this run works in — a primary checkout, a linked worktree, or no repository at all. */
	cwd: string;
}

/**
 * The primary checkout's folder, because a linked worktree's own `.lightsout` is
 * invisible to its siblings.
 *
 * `cwd`'s own spelling is kept when it names the primary: git answers with a
 * symlink-resolved path, and a state path relativised against the other spelling
 * reads as a walk-up out of the folder.
 */
export const resolveSharedStateDir = async ({ cwd }: Params): Promise<string> => {
	const primary = await readGitPrimaryCheckout({ cwd });
	const root = primary === undefined || (await isSamePath({ path: primary, otherPath: cwd })) ? cwd : primary;

	return join(root, '.lightsout');
};
