import { resolve } from 'node:path';
import { readGitTopLevel } from '#src/common/config/resolveConfigPath/readGitTopLevel.ts';
import { readGitPrimaryCheckout } from '#src/common/git/readGitPrimaryCheckout.ts';
import { isSamePath } from '#src/common/paths/isSamePath.ts';
import { pathExists } from '#src/common/paths/pathExists.ts';

interface Params {
	cwd: string;
}

const configFileName = 'lightsout.config.json';

/**
 * The primary checkout's root when `cwd` is the root of a linked worktree, and
 * undefined otherwise: a subdirectory of any checkout is not a checkout, and the
 * primary's own root has nothing to fall back to.
 */
const readPrimaryOfLinkedWorktree = async ({ cwd }: Params) => {
	const [topLevel, primary] = await Promise.all([readGitTopLevel({ cwd }), readGitPrimaryCheckout({ cwd })]);

	if (topLevel === undefined || primary === undefined || !(await isSamePath({ path: topLevel, otherPath: cwd }))) {
		return undefined;
	}

	return (await isSamePath({ path: topLevel, otherPath: primary })) ? undefined : primary;
};

/**
 * The checkout's own file when it has one, else the primary checkout's when
 * `cwd` is a linked worktree. The file may be gitignored, and a linked worktree
 * is a fresh checkout that then never carries it — the same fall-back the `.env`
 * loader makes, for the same reason. When neither has one, the checkout's own
 * path is returned, so an error names where the command looked first.
 *
 * Absolute, so a relative `--cwd` never prints a path that cannot tell two
 * checkouts apart.
 */
export const resolveConfigPath = async ({ cwd }: Params): Promise<string> => {
	const own = resolve(cwd, configFileName);

	if (await pathExists({ path: own })) {
		return own;
	}

	const primary = await readPrimaryOfLinkedWorktree({ cwd });
	const shared = primary === undefined ? undefined : resolve(primary, configFileName);

	return shared !== undefined && (await pathExists({ path: shared })) ? shared : own;
};
