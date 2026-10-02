import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from '@jest/globals';
import { WorktreeOwner } from '#src/contracts/worktree/WorktreeOwner.ts';
import { isLightsoutWorktree } from '#src/worktree/records/isLightsoutWorktree.ts';
import { seedWorkOrderRecord } from '#tests/helpers/seedWorkOrderRecord.ts';

/**
 * A primary checkout holding two work orders: one whose branch a hand-written
 * `worktree.json` claims, and one that keeps no `worktree.json` at all — a
 * branch a work order names but no worktree record claims.
 */
const setupCheckout = ({
	claimedBranch = 'lo-186-claimed',
	unclaimedBranch = 'lo-186-unclaimed',
}: {
	claimedBranch?: string;
	unclaimedBranch?: string;
} = {}) => {
	const cwd = mkdtempSync(join(tmpdir(), 'lightsout-is-worktree-'));

	seedWorkOrderRecord({ cwd, name: claimedBranch });
	seedWorkOrderRecord({ cwd, name: unclaimedBranch });
	writeFileSync(
		join(cwd, '.lightsout', 'work-orders', claimedBranch, 'worktree.json'),
		JSON.stringify({
			branch: claimedBranch,
			owner: WorktreeOwner.Implement,
			worktreePath: join(cwd, '..', 'repo-worktrees', claimedBranch),
			createdAt: '2026-01-01T00:00:00.000Z',
			startPoint: 'main',
		}),
	);

	return { cwd, claimedBranch, unclaimedBranch };
};

describe('isLightsoutWorktree', () => {
	test('answers true for a branch a worktree record claims', async () => {
		const { cwd, claimedBranch } = setupCheckout();

		const owned = await isLightsoutWorktree({ cwd, branch: claimedBranch });

		expect(owned).toBe(true);
	});

	test('answers false for an undefined branch and for a branch no record claims', async () => {
		const { cwd, unclaimedBranch } = setupCheckout();

		const answers = await Promise.all([isLightsoutWorktree({ cwd, branch: undefined }), isLightsoutWorktree({ cwd, branch: unclaimedBranch })]);

		expect(answers).toStrictEqual([false, false]);
	});
});
