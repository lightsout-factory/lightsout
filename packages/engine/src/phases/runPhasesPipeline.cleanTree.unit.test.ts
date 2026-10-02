import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@jest/globals';
import { readConfig } from '#src/common/config/readConfig.ts';
import { WorktreeOwner } from '#src/contracts/worktree/WorktreeOwner.ts';
import { runPhasesPipeline } from '#src/phases/runPhasesPipeline.ts';
import { createPhaseDriver } from '#tests/helpers/createPhaseDriver.ts';
import { readPhaseChildRuns } from '#tests/helpers/readPhaseChildRuns.ts';
import { seedWorkOrderRecord } from '#tests/helpers/seedWorkOrderRecord.ts';
import { setupCommittablePhasedRepo } from '#tests/helpers/setupCommittablePhasedRepo.ts';

/** A progress listener that leaves a person's uncommitted note in the checkout the moment phase 2 of 2 is narrated — after phase 1 committed, before phase 2 starts. */
const strayAtPhaseTwo =
	({ dir }: { dir: string }) =>
	(message: string) => {
		if (message === 'phase 2/2: phase2.md') {
			mkdirSync(join(dir, 'notes'), { recursive: true });
			writeFileSync(join(dir, 'notes', 'stray.md'), 'a note left mid-build\n');
		}
	};

/** A committable two-phase repo whose current branch a work order claims with a `worktree.json` record — a tree lightsout cut or adopted. */
const setupClaimedPhasedRepo = () => {
	const { dir, overviewPath } = setupCommittablePhasedRepo({ phases: 2 });
	const branch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: dir }).toString().trim();

	seedWorkOrderRecord({ cwd: dir, name: 'lo-186-claimed', branch });
	writeFileSync(
		join(dir, '.lightsout', 'work-orders', 'lo-186-claimed', 'worktree.json'),
		JSON.stringify({ branch, owner: WorktreeOwner.Implement, worktreePath: dir, createdAt: '2026-01-01T00:00:00.000Z' }),
	);

	return { dir, overviewPath };
};

test('stops a fresh sequence before its next phase when the checkout is edited mid-build', async () => {
	const { dir, overviewPath } = setupCommittablePhasedRepo({ phases: 2 });
	const seen: number[] = [];

	const config = await readConfig({ cwd: dir });

	const result = await runPhasesPipeline({
		cwd: dir,
		driver: createPhaseDriver({ dir, seen }),
		config,
		loadedConfig: { config },
		overviewPath,
		skipRefactor: true,
		onProgress: strayAtPhaseTwo({ dir }),
	});
	const status = execSync('git status --porcelain', { cwd: dir }).toString();
	const tracked = execSync('git ls-files src/phase1.js notes/stray.md', { cwd: dir }).toString();

	expect({ ok: result.ok, status: result.manifest.status, currentStep: result.manifest.currentStep, seen }).toStrictEqual({
		ok: false,
		status: 'failed',
		currentStep: 'phase2.md',
		seen: [1],
	});
	// phase 1 passed; phase 2 never started — still pending, naming no run
	expect(result.manifest.steps[0]?.status).toBe('passed');
	expect(result.manifest.steps[1]).toStrictEqual({ id: 'phase2.md', status: 'pending', attempts: 0 });
	expect(result.error ?? '').toContain('notes/stray.md');
	// phase 1's work is committed, and the person's note rode into no commit
	expect(tracked).toBe('src/phase1.js\n');
	expect(status).toBe('?? notes/\n');
});

test('a fresh sequence in an unedited checkout runs every phase from an empty baseline', async () => {
	const { dir, overviewPath } = setupCommittablePhasedRepo({ phases: 2 });

	const config = await readConfig({ cwd: dir });

	const result = await runPhasesPipeline({
		cwd: dir,
		driver: createPhaseDriver({ dir, seen: [] }),
		config,
		loadedConfig: { config },
		overviewPath,
		skipRefactor: true,
	});
	const children = await readPhaseChildRuns({ cwd: dir, manifest: result.manifest });

	expect({ ok: result.ok, error: result.error }).toStrictEqual({ ok: true, error: undefined });
	expect(result.manifest.steps.map((step) => step.status)).toStrictEqual(['passed', 'passed']);
	expect(children.map((child) => child.baselineDirtyFiles)).toStrictEqual([[], []]);
});

test('starts each new phase in a worktree a lightsout record claims without judging its tree', async () => {
	const { dir, overviewPath } = setupClaimedPhasedRepo();
	const seen: number[] = [];

	const config = await readConfig({ cwd: dir });

	const result = await runPhasesPipeline({
		cwd: dir,
		driver: createPhaseDriver({ dir, seen }),
		config,
		loadedConfig: { config },
		overviewPath,
		skipRefactor: true,
		onProgress: strayAtPhaseTwo({ dir }),
	});

	expect({ ok: result.ok, error: result.error }).toStrictEqual({ ok: true, error: undefined });
	expect(seen).toStrictEqual([1, 2]);
	expect(result.manifest.steps.map((step) => step.status)).toStrictEqual(['passed', 'passed']);
});
