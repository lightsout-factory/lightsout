import { spawnSync } from 'node:child_process';
import { repoRoot } from './repoRoot.mjs';

/**
 * `spawnSync` rather than `execFileSync`, so an unknown ref is an undefined
 * return instead of a thrown error every caller has to wrap.
 */
export const runGit = ({ args }) => {
	const result = spawnSync('git', args, { cwd: repoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });

	return result.status === 0 ? result.stdout.trim() : undefined;
};
