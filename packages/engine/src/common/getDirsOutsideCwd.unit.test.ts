import { mkdirSync, mkdtempSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from '@jest/globals';
import { getDirsOutsideCwd } from '#src/common/getDirsOutsideCwd.ts';

// Every directory is created on disk, so each one resolves through realpath
// the same way the cwd does (tmpdir sits behind a symlink on macOS).
const setupDirs = ({ cwdName, others }: { cwdName: string; others: string[] }) => {
	const root = mkdtempSync(join(tmpdir(), 'lightsout-dirs-outside-'));
	const cwd = join(root, cwdName);
	const dirs = others.map((other) => join(root, other));

	for (const dir of [cwd, ...dirs]) {
		mkdirSync(dir, { recursive: true });
	}

	return { root, cwd, dirs };
};

// Only the cwd is created: every other directory is one a session has not
// written yet, so it can only be judged by its literal spelling. The root is
// taken through realpath first, so that spelling agrees with the cwd's.
const setupPendingDirs = ({ cwdName, others }: { cwdName: string; others: string[] }) => {
	const root = realpathSync(mkdtempSync(join(tmpdir(), 'lightsout-dirs-pending-')));
	const cwd = join(root, cwdName);

	mkdirSync(cwd, { recursive: true });

	return { cwd, dirs: others.map((other) => join(root, other)) };
};

describe('getDirsOutsideCwd', () => {
	test('drops the cwd itself and every directory below it, keeping only those outside', async () => {
		const { root, cwd, dirs } = setupDirs({
			cwdName: 'worktree',
			others: ['primary/.lightsout/work-orders/lo-7/plans/002-search', 'worktree/.lightsout/work-orders/lo-7/plans/002-search', 'shared/notes'],
		});

		const kept = await getDirsOutsideCwd({ cwd, dirs: [cwd, ...dirs] });

		expect(kept).toStrictEqual([join(root, 'primary', '.lightsout', 'work-orders', 'lo-7', 'plans', '002-search'), join(root, 'shared', 'notes')]);
	});

	test("keeps a sibling whose name merely starts with the cwd's name", async () => {
		const { root, cwd, dirs } = setupDirs({ cwdName: 'work', others: ['worktree'] });

		const kept = await getDirsOutsideCwd({ cwd, dirs });

		expect(kept).toStrictEqual([join(root, 'worktree')]);
	});

	test('judges a directory that does not exist yet by its literal spelling', async () => {
		const { cwd, dirs } = setupPendingDirs({
			cwdName: 'worktree',
			others: ['primary/.lightsout/work-orders/lo-7/plans/002-search', 'worktree/.lightsout/work-orders/lo-7/plans/002-search'],
		});

		const kept = await getDirsOutsideCwd({ cwd, dirs });

		// a plan folder the session has yet to write is still granted when it lies
		// outside the tree, and still dropped when it lies inside it
		expect(kept).toStrictEqual([dirs[0]]);
	});
});
