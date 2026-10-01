import { execSync } from 'node:child_process';
import { existsSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from '@jest/globals';
import { getLaunchLogPath } from '#src/cli/internal/common/detach/getLaunchLogPath.ts';
import { setupBranchRepo } from '#tests/helpers/setupBranchRepo.ts';

/**
 * A primary checkout with a linked worktree added from it — the launching
 * checkout a queued ticket's session sits in, and the one place a launch log
 * could land beside the worktree rather than in the shared state dir.
 */
const setupLinkedWorktree = () => {
	const { cwd } = setupBranchRepo();
	const worktree = join(cwd, '.worktrees', 'lo-185-detach');

	execSync(`git worktree add -q -b lo-185-detach "${worktree}" main`, { cwd, stdio: 'ignore' });

	return { primary: cwd, worktree, runId: 'run-detached-1' };
};

describe('getLaunchLogPath', () => {
	test("getLaunchLogPath: names the run's log in the launches folder of the primary checkout's shared state dir, from any checkout", async () => {
		const { primary, worktree, runId } = setupLinkedWorktree();

		const [fromPrimary, fromWorktree] = await Promise.all([getLaunchLogPath({ cwd: primary, runId }), getLaunchLogPath({ cwd: worktree, runId })]);

		expect({
			fromPrimary,
			fromWorktree,
			isWorktreesOwn: fromWorktree.startsWith(join(worktree, '.lightsout')),
			createdPrimaryStateDir: existsSync(join(primary, '.lightsout')),
			createdWorktreeStateDir: existsSync(join(worktree, '.lightsout')),
		}).toStrictEqual({
			fromPrimary: join(primary, '.lightsout', 'launches', 'run-detached-1.log'),
			fromWorktree: join(realpathSync(primary), '.lightsout', 'launches', 'run-detached-1.log'),
			isWorktreesOwn: false,
			createdPrimaryStateDir: false,
			createdWorktreeStateDir: false,
		});
	});
});
