import { runGit } from './runGit.mjs';

/**
 * Ship has already fetched and merged its pinned commit, so the shipped version
 * has to clear THAT rather than the fork point. A pin git cannot resolve is a
 * problem rather than a reason to fall back: the tree is not what the caller
 * was told it is.
 *
 * @param baseCommit - the exact commit to use, overriding `base`. Defaults to `LIGHTSOUT_SHIP_BASE_COMMIT`.
 */
export const resolveShipBaseCommit = ({ base = 'origin/main', baseCommit } = {}) => {
	const pinned = baseCommit ?? process.env.LIGHTSOUT_SHIP_BASE_COMMIT;

	if (pinned === undefined || pinned === '') {
		const forkPoint = runGit({ args: ['merge-base', base, 'HEAD'] });

		return forkPoint === undefined ? { skipped: `version not checked: no ${base} to compare against` } : { baseCommit: forkPoint, pinned: false };
	}

	const resolved = runGit({ args: ['rev-parse', '--verify', `${pinned}^{commit}`] });

	return resolved === undefined ? { problem: `the pinned base commit is not a commit in this repository: ${pinned}` } : { baseCommit: resolved, pinned: true };
};
