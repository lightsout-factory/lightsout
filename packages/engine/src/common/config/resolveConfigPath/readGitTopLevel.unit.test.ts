import { execSync } from 'node:child_process';
import { mkdirSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from '@jest/globals';
import { readGitTopLevel } from '#src/common/config/resolveConfigPath/readGitTopLevel.ts';
import { setupBranchRepo } from '#tests/helpers/setupBranchRepo.ts';
import { setupConsumerRepo } from '#tests/helpers/setupConsumerRepo.ts';

describe('readGitTopLevel', () => {
	test('a subdirectory of the primary checkout names the checkout, not itself', async () => {
		const { cwd } = setupBranchRepo();
		const nested = join(cwd, 'packages', 'engine');

		mkdirSync(nested, { recursive: true });

		const topLevel = await readGitTopLevel({ cwd: nested });

		expect(topLevel === undefined ? undefined : realpathSync(topLevel)).toBe(realpathSync(cwd));
	});

	test('a linked worktree names its own root, which is what tells it from a subdirectory of the primary', async () => {
		const { cwd } = setupBranchRepo();
		const worktree = join(cwd, '.worktrees', 'lo-10-read-config-outside-worktree');

		execSync(`git worktree add -q -b lo-10-read-config-outside-worktree "${worktree}" main`, { cwd, stdio: 'ignore' });

		const topLevel = await readGitTopLevel({ cwd: worktree });

		expect(topLevel === undefined ? undefined : realpathSync(topLevel)).toBe(realpathSync(worktree));
	});

	test('a directory outside any repository reports undefined rather than raising', async () => {
		const cwd = setupConsumerRepo({ git: false });

		await expect(readGitTopLevel({ cwd })).resolves.toBe(undefined);
	});
});
