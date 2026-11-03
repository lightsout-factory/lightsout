import { execSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, realpathSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { expect, test } from '@jest/globals';
import { resolveConfigPath } from '#src/common/config/resolveConfigPath/resolveConfigPath.ts';
import { setupBranchRepo } from '#tests/helpers/setupBranchRepo.ts';

/**
 * A primary checkout and a linked worktree added from it. The config is written
 * where each case says — never committed, as a gitignored file never is — so
 * the worktree carries one only when the case writes it there.
 */
const setupWorktreeRepo = ({ primaryConfig = true, worktreeConfig = false }: { primaryConfig?: boolean; worktreeConfig?: boolean } = {}) => {
	const cwd = realpathSync(setupBranchRepo().cwd);
	const worktree = join(`${cwd}-worktrees`, 'lo-10-read-config-outside-worktree');

	execSync(`git worktree add -q -b lo-10-read-config-outside-worktree "${worktree}" main`, { cwd, stdio: 'ignore' });

	if (primaryConfig) {
		writeFileSync(join(cwd, 'lightsout.config.json'), '{}');
	}

	if (worktreeConfig) {
		writeFileSync(join(worktree, 'lightsout.config.json'), '{}');
	}

	return { cwd, worktree };
};

test('resolveConfigPath: the config sits at the root of the checkout the command was launched in', async () => {
	const cwd = mkdtempSync(join(tmpdir(), 'lightsout-config-path-'));

	writeFileSync(join(cwd, 'lightsout.config.json'), '{}');

	expect(await resolveConfigPath({ cwd })).toBe(join(cwd, 'lightsout.config.json'));
});

test('resolveConfigPath: a relative --cwd still yields an absolute path, so two checkouts never print the same one', async () => {
	// No file exists at the relative path, and nothing above the process directory
	// is a checkout holding one, so the answer is the path the command looked at.
	expect(await resolveConfigPath({ cwd: 'checkouts/lo-158' })).toBe(resolve('checkouts/lo-158', 'lightsout.config.json'));
});

test('resolveConfigPath: a linked worktree with no config of its own reads the primary checkout’s, as a gitignored file is never in the tree', async () => {
	const { cwd, worktree } = setupWorktreeRepo();

	expect(await resolveConfigPath({ cwd: worktree })).toBe(join(cwd, 'lightsout.config.json'));
});

test('resolveConfigPath: a worktree carrying its own config reads that one, not the primary checkout’s', async () => {
	const { worktree } = setupWorktreeRepo({ worktreeConfig: true });

	expect(await resolveConfigPath({ cwd: worktree })).toBe(join(worktree, 'lightsout.config.json'));
});

test('resolveConfigPath: a subdirectory of the primary checkout is no checkout, so it is not answered with the root’s config', async () => {
	const { cwd } = setupWorktreeRepo();
	const nested = join(cwd, 'packages');

	mkdirSync(nested, { recursive: true });

	expect(await resolveConfigPath({ cwd: nested })).toBe(join(nested, 'lightsout.config.json'));
});

test('resolveConfigPath: with no config in either checkout, the worktree’s own path is named, so an error says where the command looked first', async () => {
	const { worktree } = setupWorktreeRepo({ primaryConfig: false });

	expect(await resolveConfigPath({ cwd: worktree })).toBe(join(worktree, 'lightsout.config.json'));
});
