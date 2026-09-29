import { spawnSync } from 'node:child_process';
import { repoRoot } from './repoRoot.mjs';

/**
 * Compares against the WORKING TREE, not HEAD: the answer matters most just
 * after `pnpm bundle` rewrote plugin/dist/cli.mjs and before it is committed,
 * when a HEAD comparison would see no change and ask for no bump.
 */
export const changedSince = ({ baseCommit, path }) => {
	const result = spawnSync('git', ['diff', '--quiet', baseCommit, '--', path], { cwd: repoRoot, stdio: 'ignore' });

	return result.status !== 0;
};
